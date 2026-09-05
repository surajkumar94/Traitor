export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;

/** Sentinel ballot meaning "spare everyone this round". */
export const SKIP = '__skip__';

export type Role = 'traitor' | 'innocent';

export type ItemKind =
  | 'shield'
  | 'doubleVote'
  | 'spyCamera'
  | 'detectiveScan'
  | 'fakeEvidence';

export type Phase =
  | 'lobby'
  | 'reveal'
  | 'event'
  | 'night'
  | 'morning'
  | 'day'
  | 'vote'
  | 'verdict'
  | 'gameover';

export type EventKind =
  | 'blackout'
  | 'doubleVoteRound'
  | 'silence'
  | 'fastVote'
  | 'anonymousMessage';

export type Tier = 'small' | 'mid' | 'large';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  role: Role;
  alive: boolean;
  item: ItemKind | null;
  itemUsed: boolean;
  /** Tapped through the role reveal. */
  ready: boolean;
}

export interface NightState {
  /** traitor id -> victim id */
  kill: Record<string, string>;
  /** actor id -> target id, one map per targeted item */
  shield: Record<string, string>;
  scan: Record<string, string>;
  spy: Record<string, string>;
  fake: Record<string, string>;
  /** ids still expected to tap something before dawn */
  pending: string[];
}

export interface VoteState {
  /** voter id -> target id or SKIP */
  ballots: Record<string, string>;
  /** voter ids that spent a Double Vote */
  doubled: string[];
}

export type LogTone = 'death' | 'save' | 'vote' | 'info' | 'event';

export interface LogEntry {
  round: number;
  text: string;
  tone: LogTone;
}

export interface PrivateNote {
  round: number;
  item: ItemKind;
  text: string;
}

export interface MorningReport {
  victimId: string | null;
  shieldHeld: boolean;
  /** True when traitors named different victims and nobody died. */
  split: boolean;
}

export interface TraitorChatLine {
  fromId: string;
  text: string;
}

export interface VoteReport {
  eliminatedIds: string[];
  tally: Record<string, number>;
  skipWon: boolean;
  tied: boolean;
  /** Blackout keeps the voted-out player's allegiance secret. */
  rolesHidden: boolean;
}

export interface GameState {
  phase: Phase;
  round: number;
  hostId: string;
  players: Player[];
  night: NightState;
  vote: VoteState;
  activeEvent: EventKind | null;
  eventHistory: EventKind[];
  /** Day sub-stage, used by the Silence event. */
  daySilent: boolean;
  anonAuthorId: string | null;
  anonMessage: string | null;
  log: LogEntry[];
  /** player id -> private item results */
  notes: Record<string, PrivateNote[]>;
  /** Private night channel, traitors only. Cleared each dawn. */
  traitorChat: TraitorChatLine[];
  phaseEndsAt: number | null;
  morning: MorningReport | null;
  lastVote: VoteReport | null;
  winner: Role | null;
}

export function emptyNight(): NightState {
  return { kill: {}, shield: {}, scan: {}, spy: {}, fake: {}, pending: [] };
}

export function initialState(hostId: string): GameState {
  return {
    phase: 'lobby',
    round: 0,
    hostId,
    players: [],
    night: emptyNight(),
    vote: { ballots: {}, doubled: [] },
    activeEvent: null,
    eventHistory: [],
    daySilent: false,
    anonAuthorId: null,
    anonMessage: null,
    log: [],
    notes: {},
    traitorChat: [],
    phaseEndsAt: null,
    morning: null,
    lastVote: null,
    winner: null,
  };
}

export const alivePlayers = (s: GameState): Player[] => s.players.filter((p) => p.alive);
export const aliveTraitors = (s: GameState): Player[] =>
  s.players.filter((p) => p.alive && p.role === 'traitor');
export const aliveInnocents = (s: GameState): Player[] =>
  s.players.filter((p) => p.alive && p.role === 'innocent');
export const findPlayer = (s: GameState, id: string): Player | undefined =>
  s.players.find((p) => p.id === id);
export const nameOf = (s: GameState, id: string): string => findPlayer(s, id)?.name ?? 'Someone';
