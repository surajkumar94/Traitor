import type { GameState } from './types';
import { aliveInnocents, aliveTraitors } from './types';
import { pickOne, shuffled, type Rng } from './setup';

const letters = (name: string): string[] =>
  Array.from(new Set(name.toLowerCase().replace(/[^a-z]/g, '').split('')));

const list = (names: string[]): string =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * Produces one hint that is guaranteed true for the current board. Every
 * candidate is validated against live state before it can be chosen, so the
 * Clue item can never mislead its holder.
 */
export function makeClue(state: GameState, holderId: string, rng: Rng = Math.random): string {
  const traitors = aliveTraitors(state);
  if (traitors.length === 0) return 'Every traitor is already dead. Your clue finds nothing.';

  const target = pickOne(traitors, rng);
  const otherInnocents = aliveInnocents(state).filter((p) => p.id !== holderId);
  const candidates: string[] = [];

  if (otherInnocents.length >= 2) {
    const pair = shuffled(otherInnocents, rng).slice(0, 2);
    const trio = shuffled([target, ...pair], rng).map((p) => p.name);
    candidates.push(`Exactly one of ${list(trio)} is a traitor.`);
  }

  if (otherInnocents.length >= 1) {
    const cleared = pickOne(otherInnocents, rng);
    candidates.push(`${cleared.name} is not a traitor. You can trust them.`);
  }

  const initial = target.name.trim().charAt(0).toUpperCase();
  if (initial) candidates.push(`A traitor's name begins with "${initial}".`);

  const nameLetters = target.name.replace(/[^A-Za-z]/g, '');
  if (nameLetters.length > 0) {
    candidates.push(`A traitor's name has ${nameLetters.length} letters in it.`);
  }

  const pickable = letters(target.name);
  if (pickable.length > 1) {
    candidates.push(`A traitor's name contains the letter "${pickOne(pickable, rng)}".`);
  }

  candidates.push(
    traitors.length === 1
      ? 'Exactly one traitor is still breathing.'
      : `There are ${traitors.length} traitors still breathing.`,
  );

  return pickOne(candidates, rng);
}
