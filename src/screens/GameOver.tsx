import { Shell } from '../components/Shell';
import { LogFeed } from '../components/LogFeed';
import { ITEMS } from '../game/items';
import { initials } from '../lib/sanitize';
import type { Session } from '../hooks/useGame';

export function GameOver({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  if (!view || !you) return null;

  const traitorsWon = view.winner === 'traitor';
  const youWon = (view.winner === 'traitor') === (you.role === 'traitor');
  const reveal = view.finalReveal ?? [];

  return (
    <Shell eyebrow={`After ${view.round} ${view.round === 1 ? 'round' : 'rounds'}`}>
      <div className="flex flex-col gap-6">
        <div className={`role-card ${traitorsWon ? 'role-traitor' : 'role-innocent'}`}>
          <span className="text-5xl" aria-hidden>
            {traitorsWon ? '🗡' : '⚖️'}
          </span>
          <h1
            className={`display mt-3 text-[2.3rem] leading-none ${
              traitorsWon ? 'text-blood' : 'text-gold'
            }`}
          >
            {traitorsWon ? 'Traitors win' : 'Innocents win'}
          </h1>
          <p className="mt-3 text-sm text-ash">
            {youWon ? 'You were on the winning side.' : 'You were on the losing side.'}
          </p>
        </div>

        <section>
          <p className="eyebrow mb-3">Everyone, unmasked</p>
          <ul className="flex flex-col gap-2">
            {reveal.map((player) => {
              const traitor = player.role === 'traitor';
              return (
                <li
                  key={player.id}
                  className={`chip cursor-default ${traitor ? 'border-blood/45 bg-blood/10' : ''}`}
                >
                  <span className="avatar">{initials(player.name)}</span>
                  <span className="flex-1 truncate text-parchment">{player.name}</span>
                  {player.item && (
                    <span className="text-sm" aria-hidden title={ITEMS[player.item].name}>
                      {ITEMS[player.item].emoji}
                    </span>
                  )}
                  <span
                    className={`display text-[0.66rem] tracking-widest ${
                      traitor ? 'text-blood' : 'text-gold-dim'
                    }`}
                  >
                    {traitor ? 'traitor' : 'innocent'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <LogFeed entries={view.log} limit={10} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {you.isHost ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => session.send({ t: 'rematch' })}
          >
            Deal again
          </button>
        ) : (
          <p className="text-center text-sm text-ash">Waiting for the host to deal again.</p>
        )}
        <button type="button" className="btn btn-ghost" onClick={session.leave}>
          Leave the table
        </button>
      </div>
    </Shell>
  );
}
