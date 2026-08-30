import type { ReactNode } from 'react';
import type { PublicPlayer } from '../game/views';
import { initials } from '../lib/sanitize';

interface PlayerListProps {
  players: PublicPlayer[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Players that cannot be chosen right now (already dead, yourself, etc). */
  isDisabled?: (player: PublicPlayer) => boolean;
  badge?: (player: PublicPlayer) => ReactNode;
  hideDead?: boolean;
}

export function PlayerList({
  players,
  selectedId,
  onSelect,
  isDisabled,
  badge,
  hideDead,
}: PlayerListProps) {
  const visible = hideDead ? players.filter((p) => p.alive) : players;

  return (
    <ul className="stagger flex flex-col gap-2">
      {visible.map((player) => {
        const disabled = !onSelect || (isDisabled?.(player) ?? false);
        const selected = selectedId === player.id;
        return (
          <li key={player.id}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={onSelect ? selected : undefined}
              onClick={() => onSelect?.(player.id)}
              className={[
                'chip',
                selected ? 'chip-selected' : '',
                player.alive ? '' : 'chip-dead',
                disabled && !selected ? 'opacity-55' : '',
              ].join(' ')}
            >
              <span className="avatar">{initials(player.name)}</span>
              <span className="chip-name flex-1 truncate text-[1.02rem] text-parchment">
                {player.name}
              </span>
              {!player.connected && player.alive && (
                <span className="text-[0.68rem] uppercase tracking-widest text-slate">offline</span>
              )}
              {badge?.(player)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
