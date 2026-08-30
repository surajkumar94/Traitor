import { randomPlayerId, randomSecret } from '../net/peer';

const SEAT_KEY = 'traitor.seat';
const NAME_KEY = 'traitor.name';

export interface Seat {
  roomCode: string;
  playerId: string;
  secret: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing modes can refuse writes; reconnect is a nicety, not a
    // requirement, so failing silently is correct here.
  }
}

/**
 * Returns the seat held in this room, minting a fresh identity if the player
 * has not joined this code before. Keeping the id stable is what lets a phone
 * refresh mid-game and land back in the same seat.
 */
export function seatFor(roomCode: string): Seat {
  const existing = read<Seat>(SEAT_KEY);
  if (existing && existing.roomCode === roomCode && existing.playerId && existing.secret) {
    return existing;
  }
  const seat: Seat = { roomCode, playerId: randomPlayerId(), secret: randomSecret() };
  write(SEAT_KEY, seat);
  return seat;
}

export function clearSeat(): void {
  try {
    localStorage.removeItem(SEAT_KEY);
  } catch {
    /* ignore */
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
