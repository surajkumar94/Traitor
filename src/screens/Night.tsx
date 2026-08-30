import { useState } from 'react';
import { Shell } from '../components/Shell';
import { PlayerList } from '../components/PlayerList';
import { Timer } from '../components/Timer';
import { EventRibbon } from '../components/EventRibbon';
import { ITEMS } from '../game/items';
import { usableItemTonight } from '../game/views';
import type { PlayerView, PublicPlayer } from '../game/views';
import type { ItemKind } from '../game/types';
import type { Session } from '../hooks/useGame';

/** Who a given item is allowed to point at. */
function canTarget(item: ItemKind, player: PublicPlayer, view: PlayerView): boolean {
  if (!player.alive) return false;
  const you = view.you;
  if (!you) return false;
  const isSelf = player.id === you.id;
  const isFellowTraitor = view.fellowTraitors.some((t) => t.id === player.id);

  switch (item) {
    case 'shield':
      return true;
    case 'detectiveScan':
    case 'spyCamera':
      return !isSelf;
    case 'fakeEvidence':
      // Framing a fellow traitor would be a waste, so those seats are closed.
      return !isSelf && !isFellowTraitor;
    default:
      return false;
  }
}

export function Night({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  const [killTarget, setKillTarget] = useState<string | null>(null);
  const [useItem, setUseItem] = useState(false);
  const [itemTarget, setItemTarget] = useState<string | null>(null);

  if (!view || !you) return null;

  const item = usableItemTonight(view);
  const info = item ? ITEMS[item] : null;
  const traitor = you.role === 'traitor';

  if (!you.alive) {
    return (
      <Shell eyebrow={`Night ${view.round}`} title="You are gone">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="breathe text-6xl" aria-hidden>
            🕯
          </span>
          <p className="max-w-[17rem] text-sm leading-relaxed text-ash">
            The dead keep their secrets. Watch the living squirm, but say nothing.
          </p>
          <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Dawn in" />
        </div>
      </Shell>
    );
  }

  if (!view.awaitingYou) {
    return (
      <Shell eyebrow={`Night ${view.round}`} title="Eyes closed">
        <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
          <span className="breathe text-6xl" aria-hidden>
            🌙
          </span>
          <p className="max-w-[16rem] text-sm leading-relaxed text-ash">
            The castle sleeps. Nobody can see who is moving in the dark.
          </p>
          <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Dawn in" />
        </div>
        {you.isHost && (
          <button
            type="button"
            className="btn btn-ghost mt-6"
            onClick={() => session.send({ t: 'advance' })}
          >
            Force dawn
          </button>
        )}
      </Shell>
    );
  }

  const readyToConfirm = !traitor || killTarget !== null;
  const itemNeedsTarget = useItem && info?.targeted === true;
  const itemSatisfied = !itemNeedsTarget || itemTarget !== null;

  const confirm = (): void => {
    session.send({
      t: 'nightSubmit',
      kill: traitor && killTarget ? killTarget : undefined,
      itemTarget: itemNeedsTarget && itemTarget ? itemTarget : undefined,
      useItem,
    });
  };

  return (
    <Shell eyebrow={`Night ${view.round}`} title={traitor ? 'Choose your victim' : 'Your move'}>
      <EventRibbon event={view.activeEvent} />
      <div className="flex flex-col gap-6">
        <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Dawn in" />

        {traitor && (
          <section>
            <p className="eyebrow mb-3">Who dies tonight?</p>
            <PlayerList
              players={view.players}
              hideDead
              selectedId={killTarget}
              onSelect={setKillTarget}
              isDisabled={(p) =>
                p.id === you.id || view.fellowTraitors.some((t) => t.id === p.id)
              }
              badge={(p) =>
                view.fellowTraitors.some((t) => t.id === p.id) ? (
                  <span className="text-[0.66rem] uppercase tracking-widest text-blood">
                    traitor
                  </span>
                ) : null
              }
            />
            {view.traitorPicks.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-ash">
                {view.traitorPicks.map((p) => `${p.by} picked ${p.target}`).join(' · ')}
              </p>
            )}
          </section>
        )}

        {info && item && (
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                {info.emoji}
              </span>
              <p className="display text-sm text-gold">{info.name}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ash">{info.blurb}</p>

            <button
              type="button"
              aria-pressed={useItem}
              className={`chip mt-4 justify-center ${useItem ? 'chip-selected' : ''}`}
              onClick={() => {
                setUseItem((armed) => !armed);
                setItemTarget(null);
              }}
            >
              <span className="display text-xs tracking-widest text-parchment">
                {useItem ? `Spending it tonight` : `Spend it tonight?`}
              </span>
            </button>
            <p className="mt-2 text-center text-xs text-slate">
              {useItem ? 'Tap again to keep it for later.' : 'Leave it untapped to keep it.'}
            </p>

            {itemNeedsTarget && (
              <div className="mt-4">
                <p className="eyebrow mb-3">{info.prompt}</p>
                <PlayerList
                  players={view.players}
                  hideDead
                  selectedId={itemTarget}
                  onSelect={setItemTarget}
                  isDisabled={(p) => !canTarget(item, p, view)}
                />
              </div>
            )}
          </section>
        )}

        {!traitor && !info && (
          <p className="panel-inset p-5 text-sm leading-relaxed text-ash">
            You have nothing to spend tonight. Confirm and go back to sleep.
          </p>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={!readyToConfirm || !itemSatisfied}
        onClick={confirm}
      >
        {traitor && killTarget === null
          ? 'Pick a victim first'
          : itemNeedsTarget && itemTarget === null
            ? 'Pick a target first'
            : 'Confirm and sleep'}
      </button>
    </Shell>
  );
}
