import type { EventKind } from './types';
import { pickOne, type Rng } from './setup';

export interface EventInfo {
  kind: EventKind;
  emoji: string;
  title: string;
  text: string;
}

export const EVENT_INFO: Record<EventKind, EventInfo> = {
  blackout: {
    kind: 'blackout',
    emoji: '🔦',
    title: 'Blackout',
    text: 'The lights fail. Someone may be voted out, but nobody learns which side they were on.',
  },
  doubleVoteRound: {
    kind: 'doubleVoteRound',
    emoji: '🗳',
    title: 'Two Voted Out',
    text: 'The council is ruthless. This round the two players with the most votes are both voted out.',
  },
  silence: {
    kind: 'silence',
    emoji: '🤐',
    title: 'Vow of Silence',
    text: 'Nobody may speak for the first 30 seconds of the day. Watch faces instead.',
  },
  fastVote: {
    kind: 'fastVote',
    emoji: '⏰',
    title: 'Snap Judgement',
    text: 'No discussion at all. You get 10 seconds to vote. Trust your gut.',
  },
  anonymousMessage: {
    kind: 'anonymousMessage',
    emoji: '📩',
    title: 'Anonymous Letter',
    text: 'One random player may send the whole table a single unsigned message.',
  },
};

const DECK: EventKind[] = [
  'blackout',
  'doubleVoteRound',
  'silence',
  'fastVote',
  'anonymousMessage',
];

/** Draws an event, never the same one twice in a row. */
export function drawEvent(history: readonly EventKind[], rng: Rng = Math.random): EventKind {
  const previous = history[history.length - 1];
  const options = DECK.filter((kind) => kind !== previous);
  return pickOne(options.length > 0 ? options : DECK, rng);
}
