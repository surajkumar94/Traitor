import { Shell } from '../components/Shell';
import { Timer } from '../components/Timer';
import { EVENT_INFO } from '../game/events';
import type { Session } from '../hooks/useGame';

export function EventScreen({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  if (!view || !you || !view.activeEvent) return null;

  const event = EVENT_INFO[view.activeEvent];

  return (
    <Shell eyebrow={`Round ${view.round}`} title="An omen">
      <div className="flex flex-1 flex-col items-center justify-center gap-7">
        <div className="role-card role-innocent w-full">
          <span className="text-6xl" aria-hidden>
            {event.emoji}
          </span>
          <h2 className="display mt-4 text-3xl leading-none text-gold">{event.title}</h2>
          <p className="mx-auto mt-4 max-w-[17rem] text-sm leading-relaxed text-parchment">
            {event.text}
          </p>
        </div>
        <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Night falls in" />
      </div>

      {you.isHost && (
        <button
          type="button"
          className="btn btn-ghost mt-6"
          onClick={() => session.send({ t: 'advance' })}
        >
          Straight to nightfall
        </button>
      )}
    </Shell>
  );
}
