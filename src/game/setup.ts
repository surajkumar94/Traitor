import type { ItemKind, Player, Tier } from './types';

export type Rng = () => number;

export function shuffled<T>(list: readonly T[], rng: Rng): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

export function pickOne<T>(list: readonly T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)]!;
}

export function tierFor(playerCount: number): Tier {
  if (playerCount <= 5) return 'small';
  if (playerCount <= 8) return 'mid';
  return 'large';
}

/** 4-5: exactly 1. 6-8: 1 or 2. 9-12: 1 to 3. */
export function traitorCountFor(playerCount: number, rng: Rng): number {
  const tier = tierFor(playerCount);
  if (tier === 'small') return 1;
  if (tier === 'mid') return 1 + Math.floor(rng() * 2);
  return 1 + Math.floor(rng() * 3);
}

const INNOCENT_POOL: Record<Tier, ItemKind[]> = {
  small: ['shield', 'clue', 'doubleVote', 'spyCamera'],
  mid: ['shield', 'detectiveScan', 'doubleVote', 'clue', 'spyCamera'],
  large: ['shield', 'detectiveScan', 'doubleVote', 'clue', 'spyCamera'],
};

/** Deliberately few items, so the table stays simple to talk about. */
function innocentItemCount(tier: Tier, rng: Rng): number {
  if (tier === 'small') return 1 + Math.floor(rng() * 2);
  return tier === 'mid' ? 3 : 4;
}

export interface Seat {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
}

export interface Deal {
  players: Player[];
  tier: Tier;
  traitorCount: number;
}

/**
 * Assigns allegiances and items. The only source of randomness is `rng`, so a
 * deal can be reproduced in a test by passing a seeded generator.
 */
export function dealRoles(seats: readonly Seat[], rng: Rng = Math.random): Deal {
  const tier = tierFor(seats.length);
  const traitorCount = traitorCountFor(seats.length, rng);
  const order = shuffled(seats, rng);
  const traitorIds = new Set(order.slice(0, traitorCount).map((s) => s.id));

  const items = new Map<string, ItemKind>();

  const innocentIds = shuffled(
    order.filter((s) => !traitorIds.has(s.id)).map((s) => s.id),
    rng,
  );
  const pool = shuffled(INNOCENT_POOL[tier], rng);
  const handouts = Math.min(innocentItemCount(tier, rng), innocentIds.length, pool.length);
  for (let i = 0; i < handouts; i++) {
    items.set(innocentIds[i]!, pool[i]!);
  }

  // Fake Evidence only exists from 6 players up, and only in traitor hands.
  if (tier !== 'small') {
    const luckyTraitor = pickOne([...traitorIds], rng);
    items.set(luckyTraitor, 'fakeEvidence');
  }

  const players: Player[] = seats.map((seat) => ({
    id: seat.id,
    name: seat.name,
    isHost: seat.isHost,
    connected: seat.connected,
    role: traitorIds.has(seat.id) ? 'traitor' : 'innocent',
    alive: true,
    item: items.get(seat.id) ?? null,
    itemUsed: false,
    ready: false,
  }));

  return { players, tier, traitorCount };
}

/** What the lobby promises for the current headcount. */
export function tierSummary(playerCount: number): {
  tier: Tier;
  traitors: string;
  items: string;
  events: boolean;
} {
  const tier = tierFor(playerCount);
  if (tier === 'small') {
    return { tier, traitors: '1 traitor', items: '1-2 items in play', events: false };
  }
  if (tier === 'mid') {
    return { tier, traitors: '1-2 traitors', items: '3 items + fake evidence', events: false };
  }
  return { tier, traitors: '1-3 traitors', items: '4 items + fake evidence', events: true };
}
