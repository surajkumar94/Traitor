import { useEffect, useRef, useState } from 'react';

interface TimerProps {
  endsAt: number | null;
  /** Host clock reading that accompanied `endsAt`. */
  serverNow: number;
  label?: string;
  urgent?: boolean;
}

/**
 * Counts down without trusting the local clock. The host's own reading arrives
 * with every state update, so the remaining time is anchored to the moment the
 * message landed rather than to whatever this phone thinks the time is.
 */
export function useCountdown(endsAt: number | null, serverNow: number): number | null {
  const anchor = useRef({ remaining: 0, receivedAt: 0 });
  const [, force] = useState(0);

  if (endsAt !== null) {
    const remaining = endsAt - serverNow;
    if (anchor.current.remaining !== remaining) {
      anchor.current = { remaining, receivedAt: Date.now() };
    }
  }

  useEffect(() => {
    if (endsAt === null) return;
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (endsAt === null) return null;
  const elapsed = Date.now() - anchor.current.receivedAt;
  return Math.max(0, Math.ceil((anchor.current.remaining - elapsed) / 1000));
}

export function Timer({ endsAt, serverNow, label, urgent }: TimerProps) {
  const seconds = useCountdown(endsAt, serverNow);
  if (seconds === null) return null;

  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const text = mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${ss}s`;
  const critical = urgent || seconds <= 10;

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="eyebrow">{label}</span>}
      <span
        className={`tabular display text-3xl ${critical ? 'pulse-danger' : 'text-gold'}`}
        aria-live="off"
      >
        {text}
      </span>
    </div>
  );
}
