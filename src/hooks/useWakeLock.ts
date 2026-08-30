import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
}

/**
 * Keeps the screen awake while a game is running. The host especially needs
 * this: if their phone sleeps hard enough to suspend the tab, the room dies.
 * Unsupported browsers simply do nothing.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const api = (navigator as Navigator & WakeLockNavigator).wakeLock;
    if (!api) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;
      try {
        const lock = await api.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied or unavailable; nothing to recover from.
      }
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && !sentinel) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) void sentinel.release();
      sentinel = null;
    };
  }, [active]);
}
