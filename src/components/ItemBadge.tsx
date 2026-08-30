import { ITEMS } from '../game/items';
import type { ItemKind } from '../game/types';

interface ItemBadgeProps {
  kind: ItemKind;
  used?: boolean;
  compact?: boolean;
}

export function ItemBadge({ kind, used, compact }: ItemBadgeProps) {
  const info = ITEMS[kind];

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-black/30 px-2.5 py-1 text-[0.72rem] uppercase tracking-widest text-gold">
        <span aria-hidden>{info.emoji}</span>
        {info.name}
      </span>
    );
  }

  return (
    <div className={`panel-inset p-4 ${used ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {info.emoji}
        </span>
        <p className="display text-sm text-gold">{info.name}</p>
        {used && (
          <span className="ml-auto text-[0.68rem] uppercase tracking-widest text-slate">spent</span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ash">{info.blurb}</p>
    </div>
  );
}
