import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { PROTOCOL } from './protocol';

/** No I, L, O, 0 or 1: those are the characters people mistype off a screen. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

export function randomRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function randomSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomPlayerId(): string {
  return crypto.randomUUID();
}

export const peerIdForRoom = (code: string): string => `${PROTOCOL}-${code.toUpperCase()}`;

export const normaliseCode = (input: string): string =>
  input
    .toUpperCase()
    .split('')
    .filter((ch) => ALPHABET.includes(ch))
    .join('')
    .slice(0, CODE_LENGTH);

export const isCompleteCode = (input: string): boolean => normaliseCode(input).length === CODE_LENGTH;

/** Builds the URL a phone should open, derived from wherever this page is served. */
export function joinUrlFor(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#j=${code.toUpperCase()}`;
}

export function codeFromLocation(): string | null {
  const match = /[#&?]j=([A-Za-z0-9]{1,8})/.exec(window.location.hash);
  if (!match?.[1]) return null;
  const code = normaliseCode(match[1]);
  return code.length === CODE_LENGTH ? code : null;
}

function newPeer(id?: string): Peer {
  // The public PeerJS broker handles signalling only; game traffic is direct
  // browser-to-browser, so no game data ever reaches a third party.
  return id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
}

export interface HostedRoom {
  peer: Peer;
  code: string;
}

/**
 * Claims a room code on the broker. A taken code is a normal outcome rather
 * than an error, so it simply retries with a fresh code.
 */
export function hostRoom(attemptsLeft = 6): Promise<HostedRoom> {
  return new Promise((resolve, reject) => {
    const code = randomRoomCode();
    const peer = newPeer(peerIdForRoom(code));

    const cleanup = (): void => {
      peer.off('open', onOpen);
      peer.off('error', onError);
    };

    const onOpen = (): void => {
      cleanup();
      resolve({ peer, code });
    };

    const onError = (err: Error & { type?: string }): void => {
      cleanup();
      peer.destroy();
      if (err.type === 'unavailable-id' && attemptsLeft > 1) {
        hostRoom(attemptsLeft - 1).then(resolve, reject);
        return;
      }
      reject(err);
    };

    peer.on('open', onOpen);
    peer.on('error', onError);
  });
}

export interface JoinedRoom {
  peer: Peer;
  connection: DataConnection;
}

const JOIN_TIMEOUT_MS = 12_000;

export function joinRoom(code: string): Promise<JoinedRoom> {
  return new Promise((resolve, reject) => {
    const peer = newPeer();
    let settled = false;

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peer.destroy();
      reject(err);
    };

    const timer = setTimeout(
      () => fail(new Error('No answer from that room. Check the code and the host connection.')),
      JOIN_TIMEOUT_MS,
    );

    peer.on('open', () => {
      const connection = peer.connect(peerIdForRoom(code), { reliable: true });
      connection.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ peer, connection });
      });
      connection.on('error', (err: Error) => fail(err));
    });

    peer.on('error', (err: Error & { type?: string }) => {
      if (err.type === 'peer-unavailable') {
        fail(new Error('No room with that code is open right now.'));
        return;
      }
      fail(err);
    });
  });
}
