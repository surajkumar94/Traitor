/**
 * Plays thousands of games against the reducer with random decisions and
 * asserts the rules hold. Run with `npm run simulate`.
 *
 * This exists because the alternative way to find a rule bug is to gather
 * eight people in a room and waste their evening.
 */
import { reduce } from '../src/game/engine';
import type { GameAction, Ctx } from '../src/game/engine';
import { SKIP, aliveInnocents, alivePlayers, aliveTraitors, initialState } from '../src/game/types';
import type { GameState } from '../src/game/types';
import { tierFor } from '../src/game/setup';
import { viewFor } from '../src/game/views';

const GAMES_PER_SIZE = 400;
const MAX_STEPS = 4_000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'Ama',
  'Bo',
  'Cleo',
  'Dev',
  'Eze',
  'Fay',
  'Gus',
  'Hana',
  'Ivo',
  'Jun',
  'Kit',
  'Lux',
];

interface Failure {
  size: number;
  seed: number;
  reason: string;
}

const failures: Failure[] = [];
let totalGames = 0;
let totalRounds = 0;
let innocentWins = 0;
let clock = 0;

function fail(size: number, seed: number, reason: string): void {
  if (failures.length < 12) failures.push({ size, seed, reason });
}

function playOne(size: number, seed: number): void {
  const rng = mulberry32(seed);
  const ctx = (): Ctx => ({ now: (clock += 1_000), rng });
  const apply = (state: GameState, action: GameAction): GameState => reduce(state, action, ctx());

  let state = initialState('p0');
  for (let i = 0; i < size; i++) {
    state = apply(state, { t: 'join', id: `p${i}`, name: NAMES[i]!, isHost: i === 0 });
  }
  if (state.players.length !== size) {
    fail(size, seed, `only ${state.players.length} of ${size} players seated`);
    return;
  }

  state = apply(state, { t: 'start' });
  if (state.phase !== 'reveal') {
    fail(size, seed, `start did not begin the game (phase ${state.phase})`);
    return;
  }

  // Deal integrity.
  const traitors = state.players.filter((p) => p.role === 'traitor').length;
  const tier = tierFor(size);
  const maxTraitors = tier === 'small' ? 1 : tier === 'mid' ? 2 : 3;
  if (traitors < 1 || traitors > maxTraitors) {
    fail(size, seed, `dealt ${traitors} traitors for a ${tier} game`);
  }
  const fakeHolders = state.players.filter((p) => p.item === 'fakeEvidence');
  if (fakeHolders.some((p) => p.role !== 'traitor')) {
    fail(size, seed, 'fake evidence went to an innocent');
  }
  if (tier === 'small' && fakeHolders.length > 0) {
    fail(size, seed, 'fake evidence appeared in a 4-5 player game');
  }
  const itemCount = state.players.filter((p) => p.item !== null).length;
  if (itemCount === 0) fail(size, seed, 'nobody received an item');

  const traitorIds = new Set(
    state.players.filter((p) => p.role === 'traitor').map((p) => p.id),
  );

  let steps = 0;
  while (state.phase !== 'gameover' && steps < MAX_STEPS) {
    steps += 1;
    const before = state.phase;
    const beforeRound = state.round;

    switch (state.phase) {
      case 'reveal': {
        for (const p of state.players) state = apply(state, { t: 'ready', id: p.id });
        break;
      }
      case 'event':
        state = apply(state, { t: 'advance' });
        break;
      case 'night': {
        // Half the games let the timer run out instead of everyone submitting,
        // which exercises the auto-kill path.
        if (rng() < 0.5) {
          state = apply(state, { t: 'advance' });
          break;
        }
        for (const id of [...state.night.pending]) {
          const actor = state.players.find((p) => p.id === id)!;
          const victims = aliveInnocents(state).filter((p) => p.id !== id);
          const anyone = alivePlayers(state);
          const kill =
            actor.role === 'traitor' && victims.length > 0
              ? victims[Math.floor(rng() * victims.length)]!.id
              : undefined;
          const itemTarget = anyone[Math.floor(rng() * anyone.length)]!.id;
          state = apply(state, {
            t: 'nightSubmit',
            id,
            kill,
            itemTarget,
            useItem: rng() < 0.6,
          });
        }
        if (state.phase === 'night') state = apply(state, { t: 'advance' });
        break;
      }
      case 'morning':
        state = apply(state, { t: 'advance' });
        break;
      case 'day':
        state = apply(state, { t: 'advance' });
        break;
      case 'vote': {
        const living = alivePlayers(state);
        for (const voter of living) {
          const others = living.filter((p) => p.id !== voter.id);
          const target =
            rng() < 0.12 || others.length === 0
              ? SKIP
              : others[Math.floor(rng() * others.length)]!.id;
          state = apply(state, { t: 'ballot', id: voter.id, target, double: rng() < 0.3 });
        }
        if (state.phase === 'vote') state = apply(state, { t: 'advance' });
        break;
      }
      case 'lobby':
        fail(size, seed, 'fell back to the lobby mid-game');
        return;
    }

    // Murdered players must always be innocents.
    if (before === 'night' && state.morning?.victimId) {
      if (traitorIds.has(state.morning.victimId) && !state.morning.shieldHeld) {
        fail(size, seed, 'the traitors murdered one of their own');
      }
    }

    // A tick of the loop must always change something, or we would spin.
    if (state.phase === before && state.round === beforeRound && before !== 'reveal') {
      const stuck = reduce(state, { t: 'advance' }, ctx());
      if (stuck === state) {
        fail(size, seed, `stuck in phase ${before}`);
        return;
      }
      state = stuck;
    }

    // Secrecy spot-check on a random viewer.
    const viewer = state.players[Math.floor(rng() * state.players.length)]!;
    const view = viewFor(state, viewer.id, 'TEST', 0);
    if (viewer.role === 'innocent' && view.fellowTraitors.length > 0) {
      fail(size, seed, 'an innocent was handed the traitor list');
    }
    if (state.phase !== 'gameover' && view.finalReveal !== null) {
      fail(size, seed, 'roles were revealed before the game ended');
    }
    if (view.myKillTarget !== null && viewer.role !== 'traitor') {
      fail(size, seed, 'an innocent saw a kill order');
    }
  }

  if (state.phase !== 'gameover') {
    fail(size, seed, `game never ended (${steps} steps, round ${state.round})`);
    return;
  }

  const t = aliveTraitors(state).length;
  const i = aliveInnocents(state).length;
  if (state.winner === 'innocent' && t !== 0) {
    fail(size, seed, `innocents won with ${t} traitors alive`);
  }
  if (state.winner === 'traitor' && t < i) {
    fail(size, seed, `traitors won while outnumbered (${t} vs ${i})`);
  }
  if (state.winner === null) fail(size, seed, 'game over with no winner');

  totalGames += 1;
  totalRounds += state.round;
  if (state.winner === 'innocent') innocentWins += 1;
}

for (let size = 4; size <= 12; size++) {
  for (let g = 0; g < GAMES_PER_SIZE; g++) {
    playOne(size, size * 100_000 + g);
  }
}

const avgRounds = (totalRounds / Math.max(1, totalGames)).toFixed(2);
const innocentRate = ((innocentWins / Math.max(1, totalGames)) * 100).toFixed(1);

console.log(`games played      ${totalGames}`);
console.log(`average rounds    ${avgRounds}`);
console.log(`innocents win     ${innocentRate}%  (random play, no deduction)`);

if (failures.length > 0) {
  console.error(`\n${failures.length} rule failures:`);
  for (const f of failures) {
    console.error(`  ${f.size} players (seed ${f.seed}): ${f.reason}`);
  }
  process.exit(1);
}

console.log('\nno rule violations');
