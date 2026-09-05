import type { PlayerView } from '../game/views';
import type { SKIP } from '../game/types';

export const PROTOCOL = 'traitor-v1';

/**
 * Messages a phone sends to the host.
 *
 * Note that no client message carries a player id. The host derives identity
 * from the authenticated connection, so a phone cannot act on behalf of anyone
 * else by editing a payload.
 */
export type ClientMessage =
  | { t: 'hello'; playerId: string; secret: string; name: string }
  | { t: 'ready' }
  | { t: 'nightSubmit'; kill?: string; itemTarget?: string; useItem: boolean }
  | { t: 'traitorChat'; text: string }
  | { t: 'ballot'; target: string | typeof SKIP; double: boolean }
  | { t: 'anon'; text: string }
  | { t: 'rename'; name: string }
  // Host-only commands, re-checked against the host id before they are applied.
  | { t: 'start' }
  | { t: 'advance' }
  | { t: 'kick'; playerId: string }
  | { t: 'rematch' };

export type RejectReason = 'full' | 'in-progress' | 'bad-secret' | 'stale';

/** Messages the host sends back. */
export type HostMessage =
  | { t: 'welcome'; playerId: string; secret: string; roomCode: string }
  | { t: 'view'; view: PlayerView }
  | { t: 'reject'; reason: RejectReason; message: string }
  | { t: 'closed' };

export const REJECT_TEXT: Record<RejectReason, string> = {
  full: 'That room is full. Twelve is the limit.',
  'in-progress': 'That game has already started. Wait for the next round.',
  'bad-secret': 'Your seat could not be verified. Join again as a new player.',
  stale: 'That room code is no longer active.',
};

export function isClientMessage(value: unknown): value is ClientMessage {
  return typeof value === 'object' && value !== null && typeof (value as { t?: unknown }).t === 'string';
}

export function isHostMessage(value: unknown): value is HostMessage {
  return typeof value === 'object' && value !== null && typeof (value as { t?: unknown }).t === 'string';
}
