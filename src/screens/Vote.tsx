import { useState } from 'react';
import { Shell } from '../components/Shell';
import { PlayerList } from '../components/PlayerList';
import { Timer } from '../components/Timer';
import { EventRibbon } from '../components/EventRibbon';
import { SKIP } from '../game/types';
import type { Session } from '../hooks/useGame';

export function Vote({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  const [choice, setChoice] = useState<string | null>(null);
  const [useDouble, setUseDouble] = useState(false);
  if (!view || !you) return null;

  const alreadyVoted = view.myBallot !== null;
  const hasDoubleVote = you.item === 'doubleVote' && !you.itemUsed;
  const votedCount = view.players.filter((p) => p.hasVoted).length;
  const doubleRound = view.activeEvent === 'doubleVoteRound';

  if (!you.alive) {
    return (
      <Shell eyebrow={`Round ${view.round}`} title="The vote">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="breathe text-6xl" aria-hidden>
            ⚖️
          </span>
          <p className="max-w-[16rem] text-sm leading-relaxed text-ash">
            The dead do not vote. Watch them get it wrong.
          </p>
          <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Closes in" />
        </div>
      </Shell>
    );
  }

  if (alreadyVoted) {
    const target =
      view.myBallot === SKIP
        ? 'nobody'
        : (view.players.find((p) => p.id === view.myBallot)?.name ?? 'someone');
    return (
      <Shell eyebrow={`Round ${view.round}`} title="Ballot cast">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="text-5xl" aria-hidden>
            🗳
          </span>
          <p className="text-lg text-parchment">
            You voted for <span className="text-gold">{target}</span>
            {view.myDoubleSpent && <span className="text-gold"> (twice)</span>}
          </p>
          <p className="text-xs uppercase tracking-[0.24em] text-slate">
            {votedCount} of {view.aliveCount} have voted
          </p>
          <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Closes in" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      eyebrow={`Round ${view.round}`}
      title={doubleRound ? 'Banish two' : 'Who is the traitor?'}
    >
      <EventRibbon event={view.activeEvent} />
      <div className="flex flex-col gap-5">
        <Timer
          endsAt={view.phaseEndsAt}
          serverNow={view.serverNow}
          label="Closes in"
          urgent={view.activeEvent === 'fastVote'}
        />

        {doubleRound && (
          <p className="panel-inset border-gold/30 p-4 text-sm leading-relaxed text-parchment">
            Tonight the two most-voted players are both banished. Choose carefully.
          </p>
        )}

        <PlayerList
          players={view.players}
          hideDead
          selectedId={choice}
          onSelect={setChoice}
          isDisabled={(p) => p.id === you.id}
          badge={(p) =>
            p.hasVoted ? (
              <span className="text-[0.66rem] uppercase tracking-widest text-gold">voted</span>
            ) : null
          }
        />

        <button
          type="button"
          onClick={() => setChoice(SKIP)}
          className={`chip justify-center ${choice === SKIP ? 'chip-selected' : ''}`}
        >
          <span className="display text-xs tracking-widest text-ash">Banish nobody</span>
        </button>

        {hasDoubleVote && (
          <button
            type="button"
            onClick={() => setUseDouble((v) => !v)}
            className={`chip justify-center ${useDouble ? 'chip-selected' : ''}`}
          >
            <span aria-hidden>🎤</span>
            <span className="display text-xs tracking-widest text-parchment">
              {useDouble ? 'Double vote armed' : 'Spend my double vote'}
            </span>
          </button>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={choice === null}
        onClick={() => {
          if (choice === null) return;
          session.send({ t: 'ballot', target: choice, double: useDouble });
        }}
      >
        {choice === null ? 'Choose someone' : 'Lock in my vote'}
      </button>
    </Shell>
  );
}
