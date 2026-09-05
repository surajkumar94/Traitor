import { Shell } from '../components/Shell';
import { Timer } from '../components/Timer';
import type { Session } from '../hooks/useGame';

function pronounBody(name: string, role: 'traitor' | 'innocent' | null, hidden: boolean): string {
  if (hidden || role === null) {
    return `${name} is voted out in discussion. In the dark, nobody sees which side they were on.`;
  }
  if (role === 'traitor') {
    return `${name} is voted out in discussion. They are the traitor.`;
  }
  return `${name} is voted out in discussion. They are innocent. You people missed the shot.`;
}

export function Verdict({ session }: { session: Session }) {
  const view = session.view;
  const you = view?.you;
  if (!view || !you) return null;

  const report = view.lastVote;
  const names = report?.eliminatedNames ?? [];
  const roles = report?.eliminatedRoles ?? [];
  const hidden = report?.rolesHidden === true;
  const hit = !hidden && roles.some((role) => role === 'traitor');
  const miss = !hidden && names.length > 0 && roles.every((role) => role === 'innocent');

  let title = 'Nobody is voted out';
  let summary = 'The discussion ends without a name. Night falls again.';
  if (report?.tied) {
    summary = 'The vote is deadlocked. Nobody is voted out.';
  } else if (report?.skipWon) {
    summary = 'The table chose mercy. Nobody is voted out.';
  } else if (names.length === 0) {
    summary = 'Not a single vote was cast. Nobody is voted out.';
  } else if (names.length === 1) {
    title = `${names[0]} is voted out`;
    summary = pronounBody(names[0]!, roles[0] ?? null, hidden);
  } else {
    title = `${names.join(' and ')} are voted out`;
    summary = names
      .map((name, index) => pronounBody(name, roles[index] ?? null, hidden))
      .join(' ');
  }

  return (
    <Shell eyebrow={`Round ${view.round}`} title={title}>
      <div className="flex flex-col gap-6">
        <div
          className={`panel p-6 text-center ${
            hit ? 'border-verdant/40' : miss ? 'border-blood/40' : 'border-gold/25'
          }`}
        >
          <span className="text-5xl" aria-hidden>
            {hit ? '⚖️' : miss ? '🥀' : '🌙'}
          </span>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-parchment">{summary}</p>
        </div>

        <Timer endsAt={view.phaseEndsAt} serverNow={view.serverNow} label="Night falls in" />
      </div>

      {you.isHost && (
        <button
          type="button"
          className="btn btn-primary mt-6"
          onClick={() => session.send({ t: 'advance' })}
        >
          Continue
        </button>
      )}
    </Shell>
  );
}
