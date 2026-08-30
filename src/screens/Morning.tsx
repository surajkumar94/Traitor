import { Shell } from '../components/Shell';
import { Timer } from '../components/Timer';
import { LogFeed } from '../components/LogFeed';
import { EventRibbon } from '../components/EventRibbon';
import { ITEMS } from '../game/items';
import type { Session } from '../hooks/useGame';

export function Morning({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  if (!view || !you) return null;

  const report = view.morning;
  const freshNotes = view.notes.filter((note) => note.round === view.round);

  const headline = !report
    ? 'Dawn'
    : report.shieldHeld
      ? 'A shield held'
      : report.victimName
        ? `${report.victimName} is dead`
        : 'Nobody died';

  return (
    <Shell eyebrow={`Dawn of round ${view.round}`} title={headline}>
      <EventRibbon event={view.activeEvent} />
      <div className="flex flex-col gap-6">
        <div
          className={`panel p-6 text-center ${
            report?.victimName && !report.shieldHeld ? 'border-blood/40' : 'border-verdant/30'
          }`}
        >
          <span className="text-5xl" aria-hidden>
            {report?.shieldHeld ? '🛡' : report?.victimName ? '🩸' : '🌅'}
          </span>
          <p className="mt-4 text-sm leading-relaxed text-ash">
            {report?.shieldHeld
              ? 'The traitors struck and found the way barred. Everyone lived.'
              : report?.victimName
                ? 'Found in the morning. The traitors are still among you.'
                : 'The traitors held their hand. Nobody was attacked.'}
          </p>
        </div>

        {freshNotes.length > 0 && (
          <section>
            <p className="eyebrow mb-2">For your eyes only</p>
            <div className="flex flex-col gap-2">
              {freshNotes.map((note, index) => (
                <div
                  key={`${note.round}-${index}`}
                  className="panel-inset border-gold/25 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{ITEMS[note.item].emoji}</span>
                    <p className="display text-xs text-gold">{ITEMS[note.item].name}</p>
                  </div>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-parchment">{note.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate">
              Say it out loud or keep it. That choice is the whole game.
            </p>
          </section>
        )}

        <LogFeed entries={view.log} limit={4} />

        <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Discussion begins in" />
      </div>

      {you.isHost && (
        <button
          type="button"
          className="btn btn-primary mt-6"
          onClick={() => session.send({ t: 'advance' })}
        >
          Open the floor
        </button>
      )}
    </Shell>
  );
}
