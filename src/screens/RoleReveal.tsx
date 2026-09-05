import { useState } from 'react';
import { Shell } from '../components/Shell';
import { HoldToReveal } from '../components/HoldToReveal';
import { ItemBadge } from '../components/ItemBadge';
import type { Session } from '../hooks/useGame';

export function RoleReveal({ session }: { session: Session }) {
  const [revealed, setRevealed] = useState(false);
  const view = session.view;
  const you = view?.you;
  if (!view || !you) return null;

  const readyCount = view.players.filter((p) => p.ready).length;
  const traitor = you.role === 'traitor';

  if (!revealed) {
    return (
      <Shell eyebrow={`Round ${view.round}`} title="Your fate is sealed">
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <HoldToReveal onRevealed={() => setRevealed(true)} />
        </div>
        <p className="text-center text-xs uppercase tracking-[0.24em] text-slate">
          {readyCount} of {view.players.length} have looked
        </p>
      </Shell>
    );
  }

  return (
    <Shell eyebrow={`Round ${view.round}`}>
      <div className="flex flex-col gap-5">
        <div className={`role-card ${traitor ? 'role-traitor' : 'role-innocent'}`}>
          <p className="eyebrow" style={{ color: traitor ? '#ff9c92' : undefined }}>
            You are
          </p>
          <h2
            className={`display mt-2 text-[2.6rem] leading-none ${traitor ? 'text-blood' : 'text-gold'}`}
          >
            {traitor ? 'Traitor' : 'Innocent'}
          </h2>
          <p className="mx-auto mt-4 max-w-[17rem] text-sm leading-relaxed text-ash">
            {traitor
              ? 'Murder by night. Blend in by day. You win when the traitors match the number of innocents left.'
              : 'Find the traitors and vote out every one of them. Trust carefully.'}
          </p>
        </div>

        {traitor && view.fellowTraitors.length > 0 && (
          <div className="panel-inset border-blood/30 p-4">
            <p className="eyebrow" style={{ color: '#ff9c92' }}>
              Your fellow traitors
            </p>
            <p className="mt-2 text-lg text-parchment">
              {view.fellowTraitors.map((t) => t.name).join(', ')}
            </p>
            <p className="mt-2 text-xs text-ash">
              Talk on your phones at night. You cannot speak out loud. You must agree on one victim.
            </p>
          </div>
        )}

        {traitor && view.fellowTraitors.length === 0 && (
          <div className="panel-inset border-blood/30 p-4">
            <p className="text-sm text-ash">
              You work alone. Nobody else knows what you are.
            </p>
          </div>
        )}

        {you.item ? (
          <div>
            <p className="eyebrow mb-2">You were handed something</p>
            <ItemBadge kind={you.item} />
          </div>
        ) : (
          <div className="panel-inset p-4 text-sm text-ash">
            You hold no item. Your voice and your vote are your only weapons.
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {you.ready ? (
          <div className="text-center">
            <p className="display text-sm text-gold">Seal broken</p>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate">
              waiting for {view.players.length - readyCount} more
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => session.send({ t: 'ready' })}
          >
            I have memorised it
          </button>
        )}

        {/* This phase has no timer, so the host needs a way past a player who
            wandered off mid-deal. */}
        {you.isHost && readyCount < view.players.length && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => session.send({ t: 'advance' })}
          >
            Start the night without them
          </button>
        )}
      </div>
    </Shell>
  );
}
