import { useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { PlayerList } from '../components/PlayerList';
import { Timer } from '../components/Timer';
import { EventRibbon } from '../components/EventRibbon';
import { ITEMS } from '../game/items';
import { MAX_MESSAGE } from '../lib/sanitize';
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

function TraitorChat({ session }: { session: Session }) {
  const view = session.view;
  const [draft, setDraft] = useState('');
  if (!view) return null;

  const send = (): void => {
    const text = draft.trim();
    if (!text) return;
    session.send({ t: 'traitorChat', text });
    setDraft('');
  };

  return (
    <section className="panel border-blood/35 p-4">
      <p className="eyebrow" style={{ color: '#ff9c92' }}>
        Traitor channel
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ash">
        Agree here. Do not speak out loud.
      </p>
      <div className="mt-3 flex max-h-36 flex-col gap-2 overflow-y-auto">
        {view.traitorChat.length === 0 ? (
          <p className="text-xs text-slate">No messages yet.</p>
        ) : (
          view.traitorChat.map((line, index) => (
            <p
              key={`${line.fromId}-${index}-${line.text}`}
              className="text-sm leading-snug text-parchment"
            >
              <span className={line.mine ? 'text-blood' : 'text-gold'}>{line.from}</span>
              <span className="text-ash"> · </span>
              {line.text}
            </p>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="field min-w-0 flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_MESSAGE}
          placeholder="Who do we kill?"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 self-stretch rounded-[11px] border border-gold/30 px-4 text-xs uppercase tracking-[0.2em] text-gold disabled:opacity-34"
          disabled={draft.trim().length === 0}
          onClick={send}
        >
          Send
        </button>
      </div>
    </section>
  );
}

export function Night({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  const [killTarget, setKillTarget] = useState<string | null>(null);
  const [useItem, setUseItem] = useState(false);
  const [itemTarget, setItemTarget] = useState<string | null>(null);

  useEffect(() => {
    if (view?.myKillTarget) setKillTarget(view.myKillTarget);
  }, [view?.myKillTarget]);

  if (!view || !you) return null;

  const item = usableItemTonight(view);
  const info = item ? ITEMS[item] : null;
  const traitor = you.role === 'traitor';
  const teamSize = view.fellowTraitors.length + (traitor ? 1 : 0);
  const needsTeam = traitor && teamSize >= 2;
  const showKillBoard = traitor && you.alive;

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

  if (!showKillBoard && !view.awaitingYou) {
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

  const itemNeedsTarget = view.awaitingYou && useItem && info?.targeted === true;
  const itemSatisfied = !itemNeedsTarget || itemTarget !== null;
  const killSatisfied = !traitor || killTarget !== null;
  const changingPick = traitor && !view.awaitingYou;
  const pickChanged = changingPick && killTarget !== view.myKillTarget;
  const agreedTarget =
    needsTeam &&
    view.traitorIntent.length > 0 &&
    view.traitorIntent.every((row) => row.target && row.target === view.traitorIntent[0]?.target)
      ? view.traitorIntent[0]!.target
      : null;

  const confirm = (): void => {
    session.send({
      t: 'nightSubmit',
      kill: traitor && killTarget ? killTarget : undefined,
      itemTarget: itemNeedsTarget && itemTarget ? itemTarget : undefined,
      useItem: view.awaitingYou && useItem,
    });
  };

  return (
    <Shell
      eyebrow={`Night ${view.round}`}
      title={traitor ? (needsTeam ? 'Agree on a victim' : 'Choose your victim') : 'Your move'}
    >
      <EventRibbon event={view.activeEvent} />
      <div className="flex flex-col gap-6">
        <Timer
          endsAt={view.phaseEndsAt}
          serverNow={view.serverNow}
          label={traitor ? 'Kill in' : 'Dawn in'}
        />

        {needsTeam && <TraitorChat session={session} />}

        {needsTeam && (
          <section className="panel-inset border-blood/25 p-4">
            <p className="eyebrow mb-2" style={{ color: '#ff9c92' }}>
              Current picks
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-parchment">
              {view.traitorIntent.map((row) => (
                <li key={row.id}>
                  <span className={row.id === you.id ? 'text-blood' : ''}>{row.name}</span>
                  <span className="text-ash"> → </span>
                  {row.target ?? <span className="text-slate">not yet</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-ash">
              {agreedTarget
                ? `You agree: ${agreedTarget} dies. Dawn comes once everyone has acted.`
                : 'Night ends when you all pick the same person, or when the minute is up. A split team kills nobody.'}
            </p>
          </section>
        )}

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
          </section>
        )}

        {view.awaitingYou && info && item && (
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
        disabled={
          changingPick
            ? !pickChanged || !killSatisfied
            : !killSatisfied || !itemSatisfied
        }
        onClick={confirm}
      >
        {changingPick
          ? pickChanged
            ? 'Change my pick'
            : 'Waiting for the others'
          : traitor && killTarget === null
            ? 'Pick a victim first'
            : itemNeedsTarget && itemTarget === null
              ? 'Pick a target first'
              : needsTeam
                ? 'Lock in this pick'
                : 'Confirm and sleep'}
      </button>

      {you.isHost && (
        <button
          type="button"
          className="btn btn-ghost mt-3"
          onClick={() => session.send({ t: 'advance' })}
        >
          Force dawn
        </button>
      )}
    </Shell>
  );
}
