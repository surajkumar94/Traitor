import { useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { isCompleteCode, normaliseCode } from '../net/peer';
import { MAX_NAME } from '../lib/sanitize';
import type { Session } from '../hooks/useGame';

export function Home({ session }: { session: Session }) {
  const [code, setCode] = useState(session.invitedCode ?? '');
  const [showRules, setShowRules] = useState(false);
  const arrivedViaLink = session.invitedCode !== null;

  useEffect(() => {
    if (session.invitedCode) setCode(session.invitedCode);
  }, [session.invitedCode]);

  const nameReady = session.name.trim().length >= 2;

  return (
    <Shell>
      <div className="stagger flex flex-1 flex-col justify-center gap-7 py-4">
        <div className="text-center">
          <p className="eyebrow">A game of quiet betrayal</p>
          <h1 className="wordmark mt-3 text-[3.4rem] leading-[0.95]">Traitor</h1>
          <p className="mx-auto mt-3 max-w-[19rem] text-[0.95rem] leading-relaxed text-ash">
            Four to twelve players, one room, one phone each. Somebody at the table is lying.
          </p>
        </div>

        <div className="panel p-5">
          <label className="eyebrow" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="field mt-2"
            value={session.name}
            onChange={(e) => session.setName(e.target.value)}
            placeholder="What should the table call you?"
            maxLength={MAX_NAME}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
          />
        </div>

        {arrivedViaLink ? (
          <div className="panel p-5 text-center">
            <p className="eyebrow">You were invited to room</p>
            <p className="display mt-2 text-4xl tracking-[0.4em] text-gold">{code}</p>
            <button
              type="button"
              className="btn btn-primary mt-5"
              disabled={!nameReady || !isCompleteCode(code)}
              onClick={() => session.joinRoom(code)}
            >
              Take my seat
            </button>
            {!nameReady && <p className="mt-3 text-xs text-ash">Enter a name first.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!nameReady}
              onClick={session.startHosting}
            >
              Host a game
            </button>

            <div className="panel p-5">
              <label className="eyebrow" htmlFor="code">
                Join with a code
              </label>
              <input
                id="code"
                className="field code-field mt-2"
                value={code}
                onChange={(e) => setCode(normaliseCode(e.target.value))}
                placeholder="XXXX"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn mt-3"
                disabled={!nameReady || !isCompleteCode(code)}
                onClick={() => session.joinRoom(code)}
              >
                Join
              </button>
            </div>
          </div>
        )}

        <div>
          <button
            type="button"
            className="mx-auto block text-xs uppercase tracking-[0.28em] text-gold-dim"
            onClick={() => setShowRules((v) => !v)}
          >
            {showRules ? 'Hide the rules' : 'How it plays'}
          </button>
          {showRules && (
            <div className="panel mt-3 p-5 text-sm leading-relaxed text-ash">
              <p>
                Everyone sits together and talks out loud. Phones only hold the secrets: your role,
                your one-use item, your night action and your vote.
              </p>
              <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-4">
                <li>Break your wax seal to learn if you are a traitor.</li>
                <li>At night the traitors agree on someone to murder.</li>
                <li>At dawn you find out who died, then argue about it.</li>
                <li>Vote to send one person out. Their side is revealed.</li>
              </ol>
              <p className="mt-3">
                Innocents win by voting out every traitor. Traitors win once they match the number of
                innocents left.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-slate">
        No accounts, no servers. Your phones talk to each other directly.
      </p>
    </Shell>
  );
}
