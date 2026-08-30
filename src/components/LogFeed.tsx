import type { LogEntry, LogTone } from '../game/types';

const TONE_CLASS: Record<LogTone, string> = {
  death: 'text-blood',
  save: 'text-verdant',
  vote: 'text-gold',
  event: 'text-parchment',
  info: 'text-ash',
};

interface LogFeedProps {
  entries: LogEntry[];
  limit?: number;
}

export function LogFeed({ entries, limit = 6 }: LogFeedProps) {
  const shown = entries.slice(-limit).reverse();
  if (shown.length === 0) return null;

  return (
    <div className="panel-inset scroll-fade max-h-52 overflow-y-auto p-4">
      <p className="eyebrow mb-3">What the table knows</p>
      <ol className="flex flex-col gap-2.5">
        {shown.map((entry, index) => (
          <li key={`${entry.round}-${index}-${entry.text}`} className="flex gap-2.5 text-sm">
            <span className="tabular mt-0.5 shrink-0 text-[0.66rem] uppercase tracking-widest text-slate">
              R{entry.round}
            </span>
            <span className={`leading-snug ${TONE_CLASS[entry.tone]}`}>{entry.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
