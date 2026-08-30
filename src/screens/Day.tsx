import { useState } from 'react';
import { Shell } from '../components/Shell';
import { Timer } from '../components/Timer';
import { LogFeed } from '../components/LogFeed';
import { ItemBadge } from '../components/ItemBadge';
import { EventRibbon } from '../components/EventRibbon';
import { MAX_MESSAGE } from '../lib/sanitize';
import type { Session } from '../hooks/useGame';

export function Day({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  const [draft, setDraft] = useState('');
  if (!view || !you) return null;

  if (view.daySilent) {
    return (
      <Shell eyebrow={`Round ${view.round}`} title="Vow of silence">
        <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
          <span className="breathe text-6xl" aria-hidden>
            🤐
          </span>
          <p className="max-w-[16rem] text-sm leading-relaxed text-ash">
            Not a word. Watch who looks nervous and who looks too comfortable.
          </p>
          <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Silence ends in" />
        </div>
        {you.isHost && (
          <button
            type="button"
            className="btn btn-ghost mt-6"
            onClick={() => session.send({ t: 'advance' })}
          >
            End the silence early
          </button>
        )}
      </Shell>
    );
  }

  const canWriteLetter = view.youAreAnonAuthor && view.anonMessage === null && you.alive;

  return (
    <Shell eyebrow={`Round ${view.round}`} title="Talk it out">
      <EventRibbon event={view.activeEvent} />
      <div className="flex flex-col gap-6">
        <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Vote opens in" />

        {view.anonMessage && (
          <div className="panel border-gold/40 p-5">
            <p className="eyebrow">Anonymous letter</p>
            <p className="mt-2 text-lg leading-snug text-parchment">"{view.anonMessage}"</p>
            <p className="mt-2 text-xs text-slate">Nobody knows who wrote this. Not even the host.</p>
          </div>
        )}

        {canWriteLetter && (
          <div className="panel border-gold/40 p-5">
            <p className="eyebrow">You may send one unsigned message</p>
            <textarea
              className="field mt-3 min-h-[5.5rem] resize-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE}
              placeholder="Accuse someone. Or lie."
            />
            <button
              type="button"
              className="btn btn-primary mt-3"
              disabled={draft.trim().length === 0}
              onClick={() => session.send({ t: 'anon', text: draft })}
            >
              Send it to the table
            </button>
          </div>
        )}

        {you.alive && you.item && !you.itemUsed && (
          <div>
            <p className="eyebrow mb-2">Still in your pocket</p>
            <ItemBadge kind={you.item} />
          </div>
        )}

        {!you.alive && (
          <p className="panel-inset p-5 text-sm leading-relaxed text-ash">
            You are dead. Listen, enjoy it, and do not help them.
          </p>
        )}

        <LogFeed entries={view.log} />
      </div>

      {you.isHost && (
        <button
          type="button"
          className="btn btn-primary mt-6"
          onClick={() => session.send({ t: 'advance' })}
        >
          Call the vote
        </button>
      )}
    </Shell>
  );
}
