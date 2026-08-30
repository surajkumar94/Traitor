import { Shell } from '../components/Shell';
import { QrJoin } from '../components/QrJoin';
import { PlayerList } from '../components/PlayerList';
import { tierSummary } from '../game/setup';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/types';
import type { Session } from '../hooks/useGame';

export function Lobby({ session }: { session: Session }) {
  const view = session.view;
  const players = view?.players ?? [];
  const count = players.length;
  const summary = tierSummary(Math.max(count, MIN_PLAYERS));
  const canStart = count >= MIN_PLAYERS && count <= MAX_PLAYERS;

  return (
    <Shell eyebrow={`Room ${session.roomCode}`} title="The table is filling">
      <div className="flex flex-col gap-6">
        {session.isHost && <QrJoin roomCode={session.roomCode} />}

        {!session.isHost && (
          <div className="panel p-5 text-center">
            <p className="eyebrow">You are seated</p>
            <p className="display mt-2 text-xl text-parchment">{view?.you?.name ?? session.name}</p>
            <p className="mt-2 text-sm text-ash">Waiting for the host to begin.</p>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="eyebrow">
              {count} {count === 1 ? 'player' : 'players'}
            </p>
            <p className="text-[0.7rem] uppercase tracking-widest text-slate">
              {count < MIN_PLAYERS ? `${MIN_PLAYERS - count} more needed` : 'ready when you are'}
            </p>
          </div>

          {count === 0 ? (
            <div className="panel-inset p-6 text-center text-sm text-ash">
              Nobody has scanned yet.
            </div>
          ) : (
            <PlayerList
              players={players}
              onSelect={
                session.isHost
                  ? (id) => {
                      if (id !== view?.hostId) session.send({ t: 'kick', playerId: id });
                    }
                  : undefined
              }
              isDisabled={(player) => player.isHost}
              badge={(player) =>
                player.isHost ? (
                  <span className="text-[0.66rem] uppercase tracking-widest text-gold">host</span>
                ) : session.isHost ? (
                  <span className="text-[0.66rem] uppercase tracking-widest text-slate">remove</span>
                ) : null
              }
            />
          )}
        </div>

        <div className="panel p-5">
          <p className="eyebrow">With {Math.max(count, MIN_PLAYERS)} at the table</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-parchment">
            <li className="flex items-center gap-2">
              <span aria-hidden>🗡</span> {summary.traitors}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>🎁</span> {summary.items}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>{summary.events ? '🎲' : '🚫'}</span>
              {summary.events ? 'A random event every round' : 'No events at this size'}
            </li>
          </ul>
        </div>

        {session.isHost && (
          <div className="panel-inset border-gold/25 p-4">
            <p className="text-sm leading-relaxed text-ash">
              <span className="text-gold">Keep this tab open.</span> Your phone is running the game
              for everyone. If you close it or it goes to sleep, the room closes.
            </p>
          </div>
        )}
      </div>

      {session.isHost ? (
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canStart}
            onClick={() => session.send({ t: 'start' })}
          >
            {canStart ? 'Deal the roles' : `Need ${MIN_PLAYERS} players`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={session.leave}>
            Close the room
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost mt-6" onClick={session.leave}>
          Leave
        </button>
      )}
    </Shell>
  );
}
