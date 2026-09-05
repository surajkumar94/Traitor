import { alivePlayers, findPlayer } from './types';
import type {
  EventKind,
  GameState,
  ItemKind,
  LogEntry,
  Phase,
  PrivateNote,
  Role,
  Tier,
  VoteReport,
} from './types';
import { tierFor } from './setup';
import { ITEMS } from './items';

export interface PublicPlayer {
  id: string;
  name: string;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
  /** Reveal-phase readiness only. Never exposed during the night. */
  ready: boolean;
  /** Vote-phase only. */
  hasVoted: boolean;
}

export interface SelfView {
  id: string;
  name: string;
  role: Role;
  alive: boolean;
  isHost: boolean;
  item: ItemKind | null;
  itemUsed: boolean;
  ready: boolean;
}

export interface FinalReveal {
  id: string;
  name: string;
  role: Role;
  item: ItemKind | null;
  alive: boolean;
}

export interface PlayerView {
  phase: Phase;
  round: number;
  tier: Tier;
  roomCode: string;
  hostId: string;
  serverNow: number;
  phaseEndsAt: number | null;

  players: PublicPlayer[];
  aliveCount: number;
  you: SelfView | null;

  /** Populated only for traitors. */
  fellowTraitors: { id: string; name: string }[];
  /** Your own kill pick, so the night screen can show it back to you. */
  myKillTarget: string | null;
  /** Live kill proposals from the whole traitor team. Traitors only. */
  traitorIntent: { id: string; name: string; target: string | null }[];
  /** Private night chat. Traitors only, empty for everyone else. */
  traitorChat: { fromId: string; from: string; text: string; mine: boolean }[];
  /** True while the night is waiting on you. */
  awaitingYou: boolean;

  activeEvent: EventKind | null;
  daySilent: boolean;
  /** True only on the device of the chosen letter writer. */
  youAreAnonAuthor: boolean;
  anonMessage: string | null;

  log: LogEntry[];
  notes: PrivateNote[];

  morning: { victimName: string | null; shieldHeld: boolean; split: boolean } | null;
  lastVote: (VoteReport & { eliminatedNames: string[]; eliminatedRoles: (Role | null)[] }) | null;

  myBallot: string | null;
  myDoubleSpent: boolean;

  winner: Role | null;
  finalReveal: FinalReveal[] | null;
}

/**
 * Builds the single object that gets sent to one device.
 *
 * This function is the whole secrecy model: allegiances, items and night
 * actions belonging to other players are dropped here, so a player's phone
 * never receives data it is not entitled to. The only exceptions are the
 * fellow-traitor list for traitors and the full table at game over.
 */
export function viewFor(state: GameState, viewerId: string, roomCode: string, now: number): PlayerView {
  const viewer = findPlayer(state, viewerId);
  const isTraitor = viewer?.role === 'traitor';
  const showRoles = state.phase === 'gameover';
  const inVote = state.phase === 'vote';
  const inReveal = state.phase === 'reveal';

  const players: PublicPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    connected: p.connected,
    isHost: p.isHost,
    // Night progress is deliberately withheld: knowing who acted would leak
    // which players hold items or wear the traitor's mask.
    ready: inReveal ? p.ready : false,
    hasVoted: inVote ? state.vote.ballots[p.id] !== undefined : false,
  }));

  const fellowTraitors =
    isTraitor && state.phase !== 'lobby'
      ? state.players
          .filter((p) => p.role === 'traitor' && p.id !== viewerId)
          .map((p) => ({ id: p.id, name: p.name }))
      : [];

  const traitorIntent =
    isTraitor && state.phase === 'night'
      ? state.players
          .filter((p) => p.alive && p.role === 'traitor')
          .map((p) => {
            const targetId = state.night.kill[p.id];
            return {
              id: p.id,
              name: p.name,
              target: targetId ? (findPlayer(state, targetId)?.name ?? null) : null,
            };
          })
      : [];

  const traitorChat =
    isTraitor && state.phase === 'night'
      ? state.traitorChat.map((line) => ({
          fromId: line.fromId,
          from: findPlayer(state, line.fromId)?.name ?? 'A traitor',
          text: line.text,
          mine: line.fromId === viewerId,
        }))
      : [];

  const victimName =
    state.morning?.victimId && !state.morning.shieldHeld
      ? (findPlayer(state, state.morning.victimId)?.name ?? null)
      : null;

  return {
    phase: state.phase,
    round: state.round,
    tier: tierFor(state.players.length),
    roomCode,
    hostId: state.hostId,
    serverNow: now,
    phaseEndsAt: state.phaseEndsAt,

    players,
    aliveCount: alivePlayers(state).length,
    you: viewer
      ? {
          id: viewer.id,
          name: viewer.name,
          role: viewer.role,
          alive: viewer.alive,
          isHost: viewer.isHost,
          item: viewer.item,
          itemUsed: viewer.itemUsed,
          ready: viewer.ready,
        }
      : null,

    fellowTraitors,
    myKillTarget: isTraitor ? (state.night.kill[viewerId] ?? null) : null,
    traitorIntent,
    traitorChat,
    awaitingYou: state.phase === 'night' && state.night.pending.includes(viewerId),

    activeEvent: state.activeEvent,
    daySilent: state.daySilent,
    youAreAnonAuthor: state.anonAuthorId === viewerId,
    anonMessage: state.anonMessage,

    log: state.log.slice(-14),
    notes: state.notes[viewerId] ?? [],

    morning: state.morning
      ? { victimName, shieldHeld: state.morning.shieldHeld, split: state.morning.split }
      : null,
    lastVote: state.lastVote
      ? {
          ...state.lastVote,
          eliminatedNames: state.lastVote.eliminatedIds.map(
            (id) => findPlayer(state, id)?.name ?? 'Someone',
          ),
          eliminatedRoles: state.lastVote.eliminatedIds.map((id) => {
            if (state.lastVote?.rolesHidden) return null;
            return findPlayer(state, id)?.role ?? null;
          }),
        }
      : null,

    myBallot: state.vote.ballots[viewerId] ?? null,
    myDoubleSpent: state.vote.doubled.includes(viewerId),

    winner: state.winner,
    finalReveal: showRoles
      ? state.players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          item: p.item,
          alive: p.alive,
        }))
      : null,
  };
}

/** The item a player can still spend tonight, if any. */
export const usableItemTonight = (view: PlayerView): ItemKind | null => {
  const item = view.you?.item;
  if (!item || view.you?.itemUsed) return null;
  return ITEMS[item].night ? item : null;
};
