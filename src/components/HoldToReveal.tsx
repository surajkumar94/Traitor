import { useCallback, useEffect, useRef, useState } from 'react';

interface HoldToRevealProps {
  onRevealed: () => void;
  holdMs?: number;
  caption?: string;
}

/**
 * A wax seal the player must press and hold to break. The hold is deliberate:
 * a stray tap while the phone is being passed around should not expose a role,
 * and letting go re-hides it.
 */
export function HoldToReveal({ onRevealed, holdMs = 700, caption }: HoldToRevealProps) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    startedAt.current = null;
    if (!doneRef.current) setProgress(0);
  }, []);

  const step = useCallback(() => {
    if (startedAt.current === null) return;
    const elapsed = performance.now() - startedAt.current;
    const pct = Math.min(100, (elapsed / holdMs) * 100);
    setProgress(pct);
    if (pct >= 100) {
      doneRef.current = true;
      stop();
      onRevealed();
      return;
    }
    frame.current = requestAnimationFrame(step);
  }, [holdMs, onRevealed, stop]);

  const start = useCallback(() => {
    if (doneRef.current || startedAt.current !== null) return;
    startedAt.current = performance.now();
    frame.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(() => stop, [stop]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        role="button"
        tabIndex={0}
        aria-label="Press and hold to break the seal and see your role"
        className="seal"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') start();
        }}
        onKeyUp={stop}
      >
        <div className="seal-progress" style={{ ['--p' as string]: progress }} />
        <div className="text-center">
          <p className="display text-[2.6rem] leading-none text-[#ffe9e2]">T</p>
          <p className="mt-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#ffcfc7]">sealed</p>
        </div>
      </div>
      <p className="max-w-[16rem] text-center text-sm text-ash">
        {caption ?? 'Press and hold the seal. Shield your screen from the table.'}
      </p>
    </div>
  );
}
