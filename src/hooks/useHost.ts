import { useCallback, useEffect, useRef, useState } from 'react';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { hostRoom, randomPlayerId, randomSecret } from '../net/peer';
import { isClientMessage, REJECT_TEXT } from '../net/protocol';
import type { ClientMessage, HostMessage, RejectReason } from '../net/protocol';
import { reduce } from '../game/engine';
import type { GameAction } from '../game/engine';
import { MAX_PLAYERS, findPlayer, initialState } from '../game/types';
import type { GameState } from '../game/types';
import { viewFor } from '../game/views';
import type { PlayerView } from '../game/views';

export type HostStatus = 'idle' | 'opening' | 'live' | 'error';

export interface HostSession {
  status: HostStatus;
  error: string | null;
  roomCode: string;
  view: PlayerView | null;
  send: (message: ClientMessage) => void;
}

const TICK_MS = 500;

/**
 * Runs the authoritative game on the host's device.
 *
 * Every incoming message is re-attributed to the player id bound to that
 * connection, so a phone can only ever act as itself, and host-only commands
 * are checked against the host id before they reach the reducer.
 */
export function useHost(displayName: string, enabled: boolean): HostSession {
  const [status, setStatus] = useState<HostStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [view, setView] = useState<PlayerView | null>(null);

  const stateRef = useRef<GameState | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const codeRef = useRef('');
  const hostIdRef = useRef('');
  /** playerId -> live connection */
  const connsRef = useRef(new Map<string, DataConnection>());
  /** playerId -> secret proven on first hello */
  const secretsRef = useRef(new Map<string, string>());
  const nameRef = useRef(displayName);
  nameRef.current = displayName;

  const broadcast = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const now = Date.now();
    setView(viewFor(state, hostIdRef.current, codeRef.current, now));
    for (const [playerId, conn] of connsRef.current) {
      if (!conn.open) continue;
      const message: HostMessage = {
        t: 'view',
        view: viewFor(state, playerId, codeRef.current, now),
      };
      try {
        conn.send(message);
      } catch {
        // A half-open connection will be cleaned up by its close handler.
      }
    }
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      const current = stateRef.current;
      if (!current) return;
      const next = reduce(current, action, { now: Date.now(), rng: Math.random });
      // The reducer hands back the identical object when it rejects an action.
      if (next === current) return;
      stateRef.current = next;
      broadcast();
    },
    [broadcast],
  );

  const reject = (conn: DataConnection, reason: RejectReason): void => {
    const message: HostMessage = { t: 'reject', reason, message: REJECT_TEXT[reason] };
    try {
      conn.send(message);
    } catch {
      /* ignore */
    }
    setTimeout(() => conn.close(), 250);
  };

  const handleMessage = useCallback(
    (conn: DataConnection, playerId: string | null, raw: unknown): string | null => {
      if (!isClientMessage(raw)) return playerId;
      const state = stateRef.current;
      if (!state) return playerId;
      const message = raw as ClientMessage;

      if (message.t === 'hello') {
        const claimedId = typeof message.playerId === 'string' ? message.playerId : '';
        const secret = typeof message.secret === 'string' ? message.secret : '';
        if (!claimedId || !secret) {
          reject(conn, 'bad-secret');
          return null;
        }

        const known = secretsRef.current.get(claimedId);
        if (known !== undefined && known !== secret) {
          reject(conn, 'bad-secret');
          return null;
        }
        if (known === undefined) {
          const seated = findPlayer(state, claimedId);
          if (!seated && state.phase !== 'lobby') {
            reject(conn, 'in-progress');
            return null;
          }
          if (!seated && state.players.length >= MAX_PLAYERS) {
            reject(conn, 'full');
            return null;
          }
          secretsRef.current.set(claimedId, secret);
        }

        const previous = connsRef.current.get(claimedId);
        if (previous && previous !== conn) previous.close();
        connsRef.current.set(claimedId, conn);

        const welcome: HostMessage = {
          t: 'welcome',
          playerId: claimedId,
          secret,
          roomCode: codeRef.current,
        };
        conn.send(welcome);
        dispatch({ t: 'join', id: claimedId, name: message.name, isHost: false });
        dispatch({ t: 'setConnected', id: claimedId, connected: true });
        broadcast();
        return claimedId;
      }

      // Anything else requires an established seat.
      if (!playerId) return null;
      const isHost = playerId === state.hostId;

      switch (message.t) {
        case 'ready':
          dispatch({ t: 'ready', id: playerId });
          break;
        case 'nightSubmit':
          dispatch({
            t: 'nightSubmit',
            id: playerId,
            kill: message.kill,
            itemTarget: message.itemTarget,
            useItem: message.useItem === true,
          });
          break;
        case 'traitorChat':
          dispatch({
            t: 'traitorChat',
            id: playerId,
            text: String(message.text ?? ''),
          });
          break;
        case 'ballot':
          dispatch({
            t: 'ballot',
            id: playerId,
            target: String(message.target),
            double: message.double === true,
          });
          break;
        case 'anon':
          dispatch({ t: 'anon', id: playerId, text: String(message.text ?? '') });
          break;
        case 'rename':
          dispatch({ t: 'rename', id: playerId, name: String(message.name ?? '') });
          break;
        case 'start':
          if (isHost) dispatch({ t: 'start' });
          break;
        case 'advance':
          if (isHost) dispatch({ t: 'advance' });
          break;
        case 'kick':
          if (isHost && message.playerId !== state.hostId) {
            const victim = connsRef.current.get(message.playerId);
            victim?.close();
            connsRef.current.delete(message.playerId);
            secretsRef.current.delete(message.playerId);
            dispatch({ t: 'kick', id: message.playerId });
          }
          break;
        case 'rematch':
          if (isHost) dispatch({ t: 'rematch' });
          break;
      }
      return playerId;
    },
    [broadcast, dispatch],
  );

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    setStatus('opening');
    setError(null);

    hostRoom()
      .then(({ peer, code }) => {
        if (disposed) {
          peer.destroy();
          return;
        }
        const hostId = randomPlayerId();
        hostIdRef.current = hostId;
        secretsRef.current.set(hostId, randomSecret());
        codeRef.current = code;
        peerRef.current = peer;

        const fresh = initialState(hostId);
        stateRef.current = fresh;
        setRoomCode(code);
        setStatus('live');

        dispatch({ t: 'join', id: hostId, name: nameRef.current || 'Host', isHost: true });

        peer.on('connection', (conn) => {
          let playerId: string | null = null;

          conn.on('data', (raw) => {
            playerId = handleMessage(conn, playerId, raw);
          });

          conn.on('close', () => {
            if (playerId) {
              if (connsRef.current.get(playerId) === conn) connsRef.current.delete(playerId);
              dispatch({ t: 'setConnected', id: playerId, connected: false });
            }
          });

          conn.on('error', () => conn.close());
        });

        peer.on('error', (err: Error) => {
          if (disposed) return;
          setError(err.message);
        });
      })
      .catch((err: Error) => {
        if (disposed) return;
        setStatus('error');
        setError(
          err.message ||
            'Could not reach the matchmaking broker. Check your internet connection and try again.',
        );
      });

    return () => {
      disposed = true;
      for (const conn of connsRef.current.values()) {
        try {
          conn.send({ t: 'closed' } satisfies HostMessage);
        } catch {
          /* ignore */
        }
        conn.close();
      }
      connsRef.current.clear();
      peerRef.current?.destroy();
      peerRef.current = null;
      stateRef.current = null;
    };
  }, [enabled, dispatch, handleMessage]);

  // Drives phase timers. The reducer ignores ticks that are not yet due, so an
  // idle game produces no traffic at all.
  useEffect(() => {
    if (status !== 'live') return;
    const id = window.setInterval(() => dispatch({ t: 'tick' }), TICK_MS);
    return () => window.clearInterval(id);
  }, [status, dispatch]);

  const send = useCallback(
    (message: ClientMessage) => {
      const state = stateRef.current;
      if (!state) return;
      handleMessage(
        { send: () => undefined, close: () => undefined, open: true } as unknown as DataConnection,
        hostIdRef.current,
        message,
      );
    },
    [handleMessage],
  );

  useEffect(() => {
    const state = stateRef.current;
    if (status !== 'live' || !state) return;
    if (findPlayer(state, hostIdRef.current)?.name === displayName) return;
    dispatch({ t: 'rename', id: hostIdRef.current, name: displayName });
  }, [displayName, status, dispatch]);

  return { status, error, roomCode, view, send };
}
