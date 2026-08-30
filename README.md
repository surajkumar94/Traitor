# Traitor

A social deduction party game for **4 to 12 people in the same room**. One phone each, no app to install, no accounts, and no server to pay for.

Everyone talks face to face. The phones only hold the secrets: your allegiance, your one-use item, your night action, and your vote.

## How a game runs

1. One person opens the site and taps **Host a game**. They get a QR code and a four-letter room code.
2. Everyone else scans the QR with their normal camera app, types a name, and takes a seat.
3. The host taps **Deal the roles**. Each phone shows a wax seal you press and hold to see whether you are a traitor.
4. **Night:** traitors secretly choose someone to murder. Item holders act.
5. **Dawn:** you learn who died. Private results land only on the phones they belong to.
6. **Day:** argue out loud, then everyone votes. The banished player's side is revealed.
7. Innocents win by banishing every traitor. Traitors win the moment they match the number of innocents left.

## What scales with the headcount

| Players | Traitors | Items | Events |
| --- | --- | --- | --- |
| 4-5 | 1 | 1-2 in play | no |
| 6-8 | 1 or 2 | 3 plus Fake Evidence | no |
| 9-12 | 1 to 3 | 4 plus Fake Evidence | yes, one per round |

### Items

Each is single use, and only a handful exist per game, so the table can actually keep track of them.

- 🛡 **Shield** — protect anyone, including yourself, from one night's attack.
- 🔍 **Clue** — receive one hint about a traitor. It is always true.
- 🎤 **Double Vote** — your vote counts twice, once.
- 🕵 **Spy Camera** — watch one person overnight and learn who visited them.
- 🔎 **Detective Scan** — learn whether one person is a traitor.
- 🎭 **Fake Evidence** — traitors only. Frame an innocent so scans of them read TRAITOR tonight.

### Events (9-12 players)

- 🔦 **Blackout** — the banished player's side stays secret.
- 🗳 **Double Banishment** — the two most-voted players are both banished.
- 🤐 **Vow of Silence** — nobody speaks for the first 30 seconds of the day.
- ⏰ **Snap Judgement** — no discussion, 10 seconds to vote.
- 📩 **Anonymous Letter** — one random player sends the table one unsigned message.

## How it works without a backend

GitHub Pages only serves static files, so the host's browser tab *is* the server. It holds the authoritative game state, and the other phones connect straight to it over WebRTC. The public PeerJS broker is used only to introduce the peers by room code; no game data passes through it.

Two consequences worth knowing before you play:

- **The host must keep their tab open.** If it closes or the phone sleeps hard enough to suspend it, the room closes. The app requests a screen wake lock to help.
- **You still need internet**, even sitting in the same room, because the initial handshake goes through the broker. Once connected, traffic usually flows directly over your local network.

Roles never leave the host's device. Before each update is sent, `src/game/views.ts` builds a separate, redacted view per player, so your phone is never even *told* what anyone else is holding. The only exceptions are the fellow-traitor list, which traitors need, and the full table at game over.

## Deploying your own copy

Push to a **personal** GitHub account. Enterprise-managed accounts serve Pages only to signed-in enterprise members, which puts a login wall between your guests and the QR code.

```bash
git remote add origin https://github.com/<your-user>/traitor-game.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**. That is the only setting, and it is one time. Every later push rebuilds and republishes in about a minute.

Your game lives at `https://<your-user>.github.io/traitor-game/`.

Nothing hardcodes your username or repo name. `vite.config.ts` uses `base: './'` and the QR code is generated from `window.location` at runtime, so the same build works under a custom domain, a renamed repo, or any other static host.

## Running it locally

```bash
npm install
npm run dev
```

Vite prints a `Network:` URL. Open that on several phones on the same wifi, or just open a handful of browser tabs and play all the seats yourself to try it out.

```bash
npm run simulate   # plays 3600 random games and asserts the rules hold
npm run typecheck
npm run build
```

`npm run simulate` is the quickest way to check you have not broken a rule after editing `src/game/`. It drives the reducer directly and verifies things like "the traitors never murder each other", "no game runs forever", and "an innocent is never handed the traitor list". It also runs in CI before any deploy.

## If the room will not open

The public PeerJS broker is free and occasionally busy. If hosting fails, retry first. To run your own broker instead, `npm i -g peer && peerjs --port 9000`, then pass its details to `new Peer(...)` in `src/net/peer.ts`.

## Layout

```
src/
  game/     pure rules: types, dealing, the reducer, clue generator, event deck
  net/      room codes, typed messages, PeerJS host and client wrappers
  hooks/    useHost (authoritative), useClient, useGame, wake lock
  screens/  one per phase: Home, Lobby, RoleReveal, Night, Morning, Day, Vote, GameOver
scripts/    the rule simulator
```

`src/game/engine.ts` is a pure `(state, action, ctx) => state` reducer with no network or React imports. Time and randomness are injected, which is what lets the simulator replay whole games deterministically.
