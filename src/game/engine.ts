import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  SKIP,
  aliveInnocents,
  alivePlayers,
  aliveTraitors,
  emptyNight,
  findPlayer,
  initialState,
  nameOf,
} from './types';
import type {
  GameState,
  ItemKind,
  LogTone,
  Player,
  PrivateNote,
  Role,
  VoteReport,
} from './types';
import { dealRoles, pickOne, shuffled, tierFor, type Rng, type Seat } from './setup';
import { drawEvent } from './events';
import { makeClue } from './clues';
import { ITEMS } from './items';
import { cleanMessage, cleanName } from '../lib/sanitize';

export const DURATION = {
  event: 8_000,
  night: 60_000,
  morning: 18_000,
  silence: 30_000,
  vote: 35_000,
  fastVote: 10_000,
  verdict: 12_000,
} as const;

export function discussionMs(aliveCount: number): number {
  if (aliveCount <= 5) return 75_000;
  if (aliveCount <= 8) return 105_000;
  return 140_000;
}

export interface Ctx {
  now: number;
  rng: Rng;
}

export type GameAction =
  | { t: 'join'; id: string; name: string; isHost: boolean }
  | { t: 'rename'; id: string; name: string }
  | { t: 'setConnected'; id: string; connected: boolean }
  | { t: 'kick'; id: string }
  | { t: 'start' }
  | { t: 'ready'; id: string }
  | { t: 'nightSubmit'; id: string; kill?: string; itemTarget?: string; useItem: boolean }
  | { t: 'traitorChat'; id: string; text: string }
  | { t: 'ballot'; id: string; target: string; double: boolean }
  | { t: 'anon'; id: string; text: string }
  | { t: 'advance' }
  | { t: 'tick' }
  | { t: 'rematch' };

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function log(s: GameState, text: string, tone: LogTone): void {
  s.log.push({ round: s.round, text, tone });
  if (s.log.length > 60) s.log.shift();
}

function note(s: GameState, playerId: string, item: ItemKind, text: string): void {
  const notes: PrivateNote[] = s.notes[playerId] ?? [];
  notes.push({ round: s.round, item, text });
  s.notes[playerId] = notes;
}

/** Everyone who owes the night a decision: traitors always, item holders optionally. */
function nightPending(s: GameState): string[] {
  return alivePlayers(s)
    .filter((p) => {
      if (p.role === 'traitor') return true;
      return p.item !== null && !p.itemUsed && ITEMS[p.item].night;
    })
    .map((p) => p.id);
}

function beginNight(s: GameState, ctx: Ctx): void {
  s.phase = 'night';
  s.night = emptyNight();
  s.night.pending = nightPending(s);
  s.traitorChat = [];
  s.morning = null;
  s.phaseEndsAt = ctx.now + DURATION.night;
}

function beginRound(s: GameState, ctx: Ctx): void {
  s.vote = { ballots: {}, doubled: [] };
  s.lastVote = null;
  s.anonAuthorId = null;
  s.anonMessage = null;
  s.daySilent = false;

  if (tierFor(s.players.length) === 'large') {
    const kind = drawEvent(s.eventHistory, ctx.rng);
    s.activeEvent = kind;
    s.eventHistory.push(kind);
    s.phase = 'event';
    s.phaseEndsAt = ctx.now + DURATION.event;
    return;
  }

  s.activeEvent = null;
  beginNight(s, ctx);
}

/**
 * Traitors who never picked still strike so the game cannot stall.
 * Quiet seats copy the team's most common pick; if nobody picked, they share one random victim.
 */
function fillMissingKills(s: GameState, ctx: Ctx): void {
  const traitors = aliveTraitors(s);
  const targets = aliveInnocents(s);
  if (traitors.length === 0 || targets.length === 0) return;

  const existing = traitors
    .map((t) => s.night.kill[t.id])
    .filter((id): id is string => Boolean(id));

  let fill: string;
  if (existing.length > 0) {
    const counts = new Map<string, number>();
    for (const id of existing) counts.set(id, (counts.get(id) ?? 0) + 1);
    fill = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  } else {
    fill = pickOne(targets, ctx.rng).id;
  }

  for (const traitor of traitors) {
    if (!s.night.kill[traitor.id]) s.night.kill[traitor.id] = fill;
  }
}

interface Visit {
  from: string;
  to: string;
}

function chooseVictim(s: GameState): string | null {
  const counts = new Map<string, number>();
  for (const target of Object.values(s.night.kill)) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }

  let victim: string | null = null;
  let best = -1;
  let tied = false;
  for (const [target, count] of counts) {
    if (count > best) {
      victim = target;
      best = count;
      tied = false;
    } else if (count === best) {
      tied = true;
    }
  }
  // A split team kills nobody. They have a private channel; they must agree.
  return tied ? null : victim;
}

/** Night ends early only when every actor has moved and the traitors share one victim. */
function nightReady(s: GameState): boolean {
  if (s.night.pending.length > 0) return false;
  const traitors = aliveTraitors(s);
  if (traitors.length === 0) return true;
  const picks = traitors.map((t) => s.night.kill[t.id]);
  if (picks.some((id) => !id)) return false;
  return picks.every((id) => id === picks[0]);
}

function resolveNight(s: GameState, ctx: Ctx): void {
  const visits: Visit[] = [];
  const record = (map: Record<string, string>): void => {
    for (const [from, to] of Object.entries(map)) visits.push({ from, to });
  };
  record(s.night.kill);
  record(s.night.shield);
  record(s.night.scan);
  record(s.night.fake);

  const victimId = chooseVictim(s);
  const shielded = new Set(Object.values(s.night.shield));
  const shieldHeld = victimId !== null && shielded.has(victimId);

  // Clues read the board while every traitor is still standing.
  for (const holderId of s.night.clue) {
    note(s, holderId, 'clue', makeClue(s, holderId, ctx.rng));
  }

  const framed = new Set(Object.values(s.night.fake));
  for (const [actorId, targetId] of Object.entries(s.night.scan)) {
    const target = findPlayer(s, targetId);
    if (!target) continue;
    const verdict = framed.has(targetId) || target.role === 'traitor' ? 'TRAITOR' : 'INNOCENT';
    note(s, actorId, 'detectiveScan', `You scanned ${target.name}. The result reads: ${verdict}.`);
  }

  for (const [actorId, targetId] of Object.entries(s.night.spy)) {
    const visitors = [
      ...new Set(visits.filter((v) => v.to === targetId && v.from !== actorId).map((v) => v.from)),
    ].map((id) => nameOf(s, id));
    const target = nameOf(s, targetId);
    note(
      s,
      actorId,
      'spyCamera',
      visitors.length > 0
        ? `Your camera watched ${target}. Tonight they were visited by ${visitors.join(', ')}.`
        : `Your camera watched ${target}. Nobody came near them all night.`,
    );
  }

  if (victimId !== null && !shieldHeld) {
    const victim = findPlayer(s, victimId);
    if (victim) {
      victim.alive = false;
      log(s, `${victim.name} was murdered in the night.`, 'death');
    }
  } else if (victimId !== null && shieldHeld) {
    log(s, 'A shield held. The traitors struck and found nothing.', 'save');
  } else if (new Set(Object.values(s.night.kill)).size > 1) {
    log(s, 'The traitors could not agree. Nobody was attacked.', 'info');
  } else {
    log(s, 'The night passed quietly. Nobody was attacked.', 'info');
  }

  s.morning = {
    victimId,
    shieldHeld,
    split: victimId === null && new Set(Object.values(s.night.kill)).size > 1,
  };
  s.phase = 'morning';
  s.phaseEndsAt = ctx.now + DURATION.morning;

  checkWin(s);
}

function beginDay(s: GameState, ctx: Ctx): void {
  s.phase = 'day';

  if (s.activeEvent === 'anonymousMessage') {
    const living = alivePlayers(s);
    if (living.length > 0) s.anonAuthorId = pickOne(living, ctx.rng).id;
  }

  if (s.activeEvent === 'fastVote') {
    beginVote(s, ctx);
    return;
  }

  if (s.activeEvent === 'silence') {
    s.daySilent = true;
    s.phaseEndsAt = ctx.now + DURATION.silence;
    return;
  }

  s.daySilent = false;
  s.phaseEndsAt = ctx.now + discussionMs(alivePlayers(s).length);
}

function beginVote(s: GameState, ctx: Ctx): void {
  s.phase = 'vote';
  s.daySilent = false;
  s.vote = { ballots: {}, doubled: [] };
  s.phaseEndsAt =
    ctx.now + (s.activeEvent === 'fastVote' ? DURATION.fastVote : DURATION.vote);
}

function voteOut(s: GameState, id: string, rolesHidden: boolean): void {
  const player = findPlayer(s, id);
  if (!player) return;
  player.alive = false;
  if (rolesHidden) {
    log(
      s,
      `${player.name} is voted out in discussion. In the dark, nobody sees which side they were on.`,
      'vote',
    );
    return;
  }
  if (player.role === 'traitor') {
    log(s, `${player.name} is voted out in discussion. They are the traitor.`, 'vote');
    return;
  }
  log(
    s,
    `${player.name} is voted out in discussion. They are innocent. You people missed the shot.`,
    'vote',
  );
}

function resolveVote(s: GameState, ctx: Ctx): void {
  const tally: Record<string, number> = {};
  for (const [voterId, target] of Object.entries(s.vote.ballots)) {
    const weight = s.vote.doubled.includes(voterId) ? 2 : 1;
    tally[target] = (tally[target] ?? 0) + weight;
  }

  const skipCount = tally[SKIP] ?? 0;
  const ranked = Object.entries(tally)
    .filter(([id]) => id !== SKIP)
    .sort((a, b) => b[1] - a[1]);

  const rolesHidden = s.activeEvent === 'blackout';
  const doubleVoteOut = s.activeEvent === 'doubleVoteRound';
  const report: VoteReport = {
    eliminatedIds: [],
    tally,
    skipWon: false,
    tied: false,
    rolesHidden,
  };

  const top = ranked[0];
  const second = ranked[1];

  if (!top) {
    log(s, 'Not a single vote was cast. Nobody is voted out.', 'info');
  } else if (second && second[1] === top[1]) {
    report.tied = true;
    log(s, 'The vote is deadlocked. Nobody is voted out.', 'info');
  } else if (top[1] <= skipCount) {
    report.skipWon = true;
    log(s, 'The table chose mercy. Nobody is voted out.', 'info');
  } else {
    report.eliminatedIds.push(top[0]);
    if (doubleVoteOut && second && (!ranked[2] || ranked[2][1] !== second[1])) {
      report.eliminatedIds.push(second[0]);
    }
    for (const id of report.eliminatedIds) voteOut(s, id, rolesHidden);
  }

  s.lastVote = report;

  s.phase = 'verdict';
  s.phaseEndsAt = ctx.now + DURATION.verdict;
}

function checkWin(s: GameState): boolean {
  const traitors = aliveTraitors(s).length;
  const innocents = aliveInnocents(s).length;

  let winner: Role | null = null;
  if (traitors === 0) winner = 'innocent';
  else if (traitors >= innocents) winner = 'traitor';
  if (!winner) return false;

  s.winner = winner;
  s.phase = 'gameover';
  s.phaseEndsAt = null;
  log(
    s,
    winner === 'innocent'
      ? 'Every traitor has been dragged into the light. The innocents win.'
      : 'The traitors outnumber the faithful. The traitors win.',
    winner === 'innocent' ? 'save' : 'death',
  );
  return true;
}

/** Ends whatever phase is running and moves the game forward one step. */
function advance(s: GameState, ctx: Ctx): void {
  switch (s.phase) {
    case 'reveal':
      beginRound(s, ctx);
      return;
    case 'event':
      beginNight(s, ctx);
      return;
    case 'night':
      fillMissingKills(s, ctx);
      resolveNight(s, ctx);
      return;
    case 'morning':
      beginDay(s, ctx);
      return;
    case 'day':
      if (s.daySilent) {
        s.daySilent = false;
        s.phaseEndsAt = ctx.now + discussionMs(alivePlayers(s).length);
        return;
      }
      beginVote(s, ctx);
      return;
    case 'vote':
      resolveVote(s, ctx);
      return;
    case 'verdict':
      if (checkWin(s)) return;
      s.round += 1;
      beginRound(s, ctx);
      return;
    case 'lobby':
    case 'gameover':
      return;
  }
}

/* ------------------------------------------------------------------ */
/* reducer                                                             */
/* ------------------------------------------------------------------ */

/**
 * Pure state transition. `now` and `rng` arrive through `ctx` so the whole rule
 * set can be replayed deterministically outside the browser.
 */
export function reduce(state: GameState, action: GameAction, ctx: Ctx): GameState {
  const s: GameState = structuredClone(state);

  switch (action.t) {
    case 'join': {
      const name = cleanName(action.name) || 'Player';
      const existing = findPlayer(s, action.id);
      if (existing) {
        existing.name = name;
        existing.connected = true;
        return s;
      }
      if (s.phase !== 'lobby') return state;
      if (s.players.length >= MAX_PLAYERS) return state;
      s.players.push({
        id: action.id,
        name,
        isHost: action.isHost,
        connected: true,
        role: 'innocent',
        alive: true,
        item: null,
        itemUsed: false,
        ready: false,
      });
      return s;
    }

    case 'rename': {
      const player = findPlayer(s, action.id);
      if (!player || s.phase !== 'lobby') return state;
      player.name = cleanName(action.name) || player.name;
      return s;
    }

    case 'setConnected': {
      const player = findPlayer(s, action.id);
      if (!player) return state;
      player.connected = action.connected;
      // A drop-out in the lobby simply leaves; mid-game their seat is kept.
      if (!action.connected && s.phase === 'lobby' && !player.isHost) {
        s.players = s.players.filter((p) => p.id !== action.id);
      }
      return s;
    }

    case 'kick': {
      if (s.phase !== 'lobby') return state;
      s.players = s.players.filter((p) => p.id !== action.id || p.isHost);
      return s;
    }

    case 'start': {
      if (s.phase !== 'lobby') return state;
      if (s.players.length < MIN_PLAYERS || s.players.length > MAX_PLAYERS) return state;

      const seats: Seat[] = s.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
      }));
      const deal = dealRoles(seats, ctx.rng);
      s.players = deal.players;
      s.round = 1;
      s.phase = 'reveal';
      s.phaseEndsAt = null;
      s.log = [];
      s.notes = {};
      s.traitorChat = [];
      s.eventHistory = [];
      s.winner = null;
      log(s, `${deal.players.length} gather at the table. Trust no one.`, 'info');
      return s;
    }

    case 'ready': {
      if (s.phase !== 'reveal') return state;
      const player = findPlayer(s, action.id);
      if (!player) return state;
      player.ready = true;
      if (s.players.every((p) => p.ready || !p.alive)) advance(s, ctx);
      return s;
    }

    case 'nightSubmit': {
      if (s.phase !== 'night') return state;
      const actor = findPlayer(s, action.id);
      if (!actor || !actor.alive) return state;

      const inPending = s.night.pending.includes(actor.id);
      const traitorRetarget = actor.role === 'traitor';
      if (!inPending && !traitorRetarget) return state;

      if (actor.role === 'traitor') {
        const target = action.kill ? findPlayer(s, action.kill) : undefined;
        if (!target || !target.alive || target.role === 'traitor') {
          if (inPending) return state;
        } else {
          s.night.kill[actor.id] = target.id;
        }
      }

      if (inPending && action.useItem && actor.item && !actor.itemUsed) {
        const info = ITEMS[actor.item];
        if (info.night && (!info.traitorOnly || actor.role === 'traitor')) {
          if (info.targeted) {
            const target = action.itemTarget ? findPlayer(s, action.itemTarget) : undefined;
            if (target && target.alive) {
              const bucket =
                actor.item === 'shield'
                  ? s.night.shield
                  : actor.item === 'detectiveScan'
                    ? s.night.scan
                    : actor.item === 'spyCamera'
                      ? s.night.spy
                      : s.night.fake;
              bucket[actor.id] = target.id;
              actor.itemUsed = true;
            }
          } else if (actor.item === 'clue') {
            s.night.clue.push(actor.id);
            actor.itemUsed = true;
          }
        }
      }

      if (inPending) {
        s.night.pending = s.night.pending.filter((id) => id !== actor.id);
      }
      if (nightReady(s)) advance(s, ctx);
      return s;
    }

    case 'traitorChat': {
      if (s.phase !== 'night') return state;
      const actor = findPlayer(s, action.id);
      if (!actor || !actor.alive || actor.role !== 'traitor') return state;
      if (aliveTraitors(s).length < 2) return state;
      const text = cleanMessage(action.text);
      if (!text) return state;
      s.traitorChat.push({ fromId: actor.id, text });
      if (s.traitorChat.length > 30) s.traitorChat.shift();
      return s;
    }

    case 'ballot': {
      if (s.phase !== 'vote') return state;
      const voter = findPlayer(s, action.id);
      if (!voter || !voter.alive) return state;
      if (action.target !== SKIP) {
        const target = findPlayer(s, action.target);
        if (!target || !target.alive) return state;
      }

      s.vote.ballots[voter.id] = action.target;
      if (
        action.double &&
        voter.item === 'doubleVote' &&
        !voter.itemUsed &&
        !s.vote.doubled.includes(voter.id)
      ) {
        voter.itemUsed = true;
        s.vote.doubled.push(voter.id);
      }

      const living = alivePlayers(s);
      if (living.every((p) => s.vote.ballots[p.id] !== undefined)) advance(s, ctx);
      return s;
    }

    case 'anon': {
      if (s.phase !== 'day' || s.anonAuthorId !== action.id || s.anonMessage !== null) return state;
      const text = cleanMessage(action.text);
      if (!text) return state;
      s.anonMessage = text;
      log(s, `Anonymous letter: "${text}"`, 'event');
      return s;
    }

    case 'advance': {
      advance(s, ctx);
      return s;
    }

    case 'tick': {
      if (s.phaseEndsAt === null || ctx.now < s.phaseEndsAt) return state;
      advance(s, ctx);
      return s;
    }

    case 'rematch': {
      const fresh = initialState(s.hostId);
      fresh.players = shuffled(s.players, ctx.rng).map<Player>((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
        role: 'innocent',
        alive: true,
        item: null,
        itemUsed: false,
        ready: false,
      }));
      return fresh;
    }
  }
}
