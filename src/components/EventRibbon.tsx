import { EVENT_INFO } from '../game/events';
import type { EventKind } from '../game/types';

/** Persistent reminder of the round's event, shown above the round screens. */
export function EventRibbon({ event }: { event: EventKind | null }) {
  if (!event) return null;
  const info = EVENT_INFO[event];

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-gold/25 bg-gold/8 px-3.5 py-2.5">
      <span aria-hidden>{info.emoji}</span>
      <span className="display text-[0.68rem] tracking-[0.2em] text-gold">{info.title}</span>
      <span className="ml-auto text-right text-[0.68rem] leading-tight text-ash">
        {SHORT[info.kind]}
      </span>
    </div>
  );
}

const SHORT: Record<EventKind, string> = {
  blackout: 'voted-out side stays secret',
  doubleVoteRound: 'two are voted out',
  silence: '30s of silence first',
  fastVote: '10 seconds to vote',
  anonymousMessage: 'one unsigned letter',
};
