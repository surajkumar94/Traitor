import { useCallback, useEffect, useRef, useState } from 'react';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { joinRoom } from '../net/peer';
import { isHostMessage } from '../net/protocol';
import type { ClientMessage, HostMessage } from '../net/protocol';
import type { PlayerView } from '../game/views';
import { seatFor } from '../lib/storage';

export type ClientStatus = 'connecting' | 'live' | 'reconnecting' | 'error' | 'closed';

export interface ClientSession {
  status: ClientStatus;
  error: string | null;
  view: PlayerView | null;
  send: (message: ClientMessage) => void;
}

const MAX_ATTEMPTS = 6;
const RETRY_MS = 2_000;

/**
 * Connects a phone to the host. Identity comes from localStorage, so a refresh
 * or a dropped connection returns the player to the same seat rather than
 * spawning a duplicate.
 */
export function useClient(roomCode: string, displayName: string, enabled: boolean): ClientSession {
  const [status, setStatus] = useState<ClientStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const nameRef = useRef(displayName);
  nameRef.current = displayName;

  useEffect(() => {
    if (!enabled || !roomCode) return;

    let disposed = false;
    let attempt = 0;
    let retryTimer: number | undefined;

    const teardown = (): void => {
      connRef.current?.close();
      connRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
    };

    const attach = (peer: Peer, connection: DataConnection): void => {
      peerRef.current = peer;
      connRef.current = connection;

      const seat = seatFor(roomCode);
      const hello: ClientMessage = {
        t: 'hello',
        playerId: seat.playerId,
        secret: seat.secret,
        name: nameRef.current,
      };
      connection.send(hello);

      connection.on('data', (raw) => {
        if (disposed || !isHostMessage(raw)) return;
        const message = raw as HostMessage;
        switch (message.t) {
          case 'welcome':
            attempt = 0;
            setStatus('live');
            setError(null);
            break;
          case 'view':
            setStatus('live');
            setView(message.view);
            break;
          case 'reject':
            setStatus('error');
            setError(message.message);
            attempt = MAX_ATTEMPTS;
            break;
          case 'closed':
            setStatus('closed');
            attempt = MAX_ATTEMPTS;
            break;
        }
      });

      connection.on('close', () => {
        if (disposed) return;
        connRef.current = null;
        scheduleRetry();
      });

      connection.on('error', () => {
        if (disposed) return;
        scheduleRetry();
      });
    };

    const scheduleRetry = (): void => {
      if (disposed || attempt >= MAX_ATTEMPTS) {
        if (!disposed && attempt >= MAX_ATTEMPTS) {
          setStatus((current) => (current === 'error' || current === 'closed' ? current : 'error'));
          setError((current) => current ?? 'Lost contact with the host. Ask them to re-share the code.');
        }
        return;
      }
      setStatus('reconnecting');
      teardown();
      retryTimer = window.setTimeout(connect, RETRY_MS);
    };

    const connect = (): void => {
      if (disposed) return;
      attempt += 1;
      joinRoom(roomCode)
        .then(({ peer, connection }) => {
          if (disposed) {
            peer.destroy();
            return;
          }
          attach(peer, connection);
        })
        .catch((err: Error) => {
          if (disposed) return;
          if (attempt >= MAX_ATTEMPTS) {
            setStatus('error');
            setError(err.message);
            return;
          }
          scheduleRetry();
        });
    };

    setStatus('connecting');
    setError(null);
    connect();

    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      teardown();
    };
  }, [roomCode, enabled]);

  const send = useCallback((message: ClientMessage) => {
    const conn = connRef.current;
    if (!conn?.open) return;
    try {
      conn.send(message);
    } catch {
      // Drop it; the close handler will start a reconnect.
    }
  }, []);

  useEffect(() => {
    if (status !== 'live') return;
    if (view?.you && view.you.name !== displayName && displayName.length > 0) {
      send({ t: 'rename', name: displayName });
    }
  }, [displayName, status, view?.you, send]);

  return { status, error, view, send };
}
