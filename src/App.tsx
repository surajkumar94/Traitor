import type { ReactElement } from 'react';
import { useGame } from './hooks/useGame';
import type { Session } from './hooks/useGame';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { RoleReveal } from './screens/RoleReveal';
import { EventScreen } from './screens/EventScreen';
import { Night } from './screens/Night';
import { Morning } from './screens/Morning';
import { Day } from './screens/Day';
import { Vote } from './screens/Vote';
import { Verdict } from './screens/Verdict';
import { GameOver } from './screens/GameOver';
import { Connecting, Problem } from './screens/Connecting';

/**
 * Plain function rather than a nested component: screens hold local state
 * (the unbroken wax seal, a half-written vote) that must survive re-renders.
 */
function screenFor(session: Session): ReactElement {
  if (session.mode === 'home') return <Home session={session} />;

  if (session.status === 'error') {
    return (
      <Problem
        session={session}
        message={session.error ?? 'The connection could not be established.'}
      />
    );
  }

  if (session.status === 'closed') {
    return <Problem session={session} message="The host closed the room. That game is over." />;
  }

  if (session.status === 'reconnecting') {
    return (
      <Connecting
        session={session}
        title="Reconnecting"
        detail="Lost the host for a moment. Holding your seat and trying again."
      />
    );
  }

  if (!session.view) {
    return (
      <Connecting
        session={session}
        title={session.isHost ? 'Lighting the candles' : 'Finding the room'}
        detail={
          session.isHost
            ? 'Claiming a room code so your friends can scan in.'
            : `Knocking on room ${session.roomCode}. Give it a moment on a slow connection.`
        }
      />
    );
  }

  switch (session.view.phase) {
    case 'lobby':
      return <Lobby session={session} />;
    case 'reveal':
      return <RoleReveal session={session} />;
    case 'event':
      return <EventScreen session={session} />;
    case 'night':
      return <Night session={session} />;
    case 'morning':
      return <Morning session={session} />;
    case 'day':
      return <Day session={session} />;
    case 'vote':
      return <Vote session={session} />;
    case 'verdict':
      return <Verdict session={session} />;
    case 'gameover':
      return <GameOver session={session} />;
  }
}

export default function App() {
  const session = useGame();

  return (
    <>
      <div className="atmosphere" aria-hidden />
      <div className="grain" aria-hidden />
      {screenFor(session)}
    </>
  );
}
