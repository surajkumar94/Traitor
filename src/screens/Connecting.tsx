import { Shell } from '../components/Shell';
import type { Session } from '../hooks/useGame';

interface ConnectingProps {
  session: Session;
  title: string;
  detail: string;
}

export function Connecting({ session, title, detail }: ConnectingProps) {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <span className="breathe text-5xl" aria-hidden>
          🕯
        </span>
        <div>
          <h1 className="display text-xl text-parchment">{title}</h1>
          <p className="mx-auto mt-3 max-w-[17rem] text-sm leading-relaxed text-ash">{detail}</p>
        </div>
      </div>
      <button type="button" className="btn btn-ghost mt-6" onClick={session.leave}>
        Back
      </button>
    </Shell>
  );
}

export function Problem({ session, message }: { session: Session; message: string }) {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <span className="text-5xl" aria-hidden>
          🕳
        </span>
        <div>
          <h1 className="display text-xl text-blood">Something broke</h1>
          <p className="mx-auto mt-3 max-w-[18rem] text-sm leading-relaxed text-ash">{message}</p>
        </div>
      </div>
      <button type="button" className="btn btn-primary mt-6" onClick={session.leave}>
        Start over
      </button>
    </Shell>
  );
}
