import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHost } from './useHost';
import { useClient } from './useClient';
import { useWakeLock } from './useWakeLock';
import { codeFromLocation, normaliseCode } from '../net/peer';
import { clearSeat, loadName, saveName } from '../lib/storage';
import { cleanName } from '../lib/sanitize';
import type { ClientMessage } from '../net/protocol';
import type { PlayerView } from '../game/views';

export type Mode = 'home' | 'host' | 'join';

export interface Session {
  mode: Mode;
  name: string;
  setName: (name: string) => void;
  roomCode: string;
  view: PlayerView | null;
  /** 'connecting' | 'live' | 'reconnecting' | 'error' | 'closed' */
  status: 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error' | 'closed';
  error: string | null;
  isHost: boolean;
  startHosting: () => void;
  joinRoom: (code: string) => void;
  leave: () => void;
  send: (message: ClientMessage) => void;
  /** A code picked up from the QR link, if the player arrived that way. */
  invitedCode: string | null;
}

export function useGame(): Session {
  const [mode, setMode] = useState<Mode>('home');
  const [name, setNameState] = useState<string>(() => loadName());
  const [joinCode, setJoinCode] = useState('');
  const [invitedCode, setInvitedCode] = useState<string | null>(() => codeFromLocation());

  const host = useHost(name, mode === 'host');
  const client = useClient(joinCode, name, mode === 'join');

  useWakeLock(mode !== 'home');

  useEffect(() => {
    const onHashChange = (): void => setInvitedCode(codeFromLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setName = useCallback((next: string) => {
    const cleaned = cleanName(next);
    setNameState(cleaned);
    saveName(cleaned);
  }, []);

  const startHosting = useCallback(() => {
    setMode('host');
  }, []);

  const joinRoom = useCallback((code: string) => {
    const normalised = normaliseCode(code);
    if (normalised.length !== 4) return;
    setJoinCode(normalised);
    setMode('join');
  }, []);

  const leave = useCallback(() => {
    setMode('home');
    setJoinCode('');
    clearSeat();
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setInvitedCode(null);
    }
  }, []);

  return useMemo<Session>(() => {
    if (mode === 'host') {
      return {
        mode,
        name,
        setName,
        roomCode: host.roomCode,
        view: host.view,
        status:
          host.status === 'live'
            ? 'live'
            : host.status === 'error'
              ? 'error'
              : host.status === 'opening'
                ? 'connecting'
                : 'idle',
        error: host.error,
        isHost: true,
        startHosting,
        joinRoom,
        leave,
        send: host.send,
        invitedCode,
      };
    }

    if (mode === 'join') {
      return {
        mode,
        name,
        setName,
        roomCode: joinCode,
        view: client.view,
        status: client.status,
        error: client.error,
        isHost: false,
        startHosting,
        joinRoom,
        leave,
        send: client.send,
        invitedCode,
      };
    }

    return {
      mode,
      name,
      setName,
      roomCode: '',
      view: null,
      status: 'idle',
      error: null,
      isHost: false,
      startHosting,
      joinRoom,
      leave,
      send: () => undefined,
      invitedCode,
    };
  }, [mode, name, setName, host, client, joinCode, startHosting, joinRoom, leave, invitedCode]);
}
