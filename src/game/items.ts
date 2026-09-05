import type { ItemKind } from './types';

export interface ItemInfo {
  kind: ItemKind;
  emoji: string;
  name: string;
  /** One line the player reads when they get it. */
  blurb: string;
  /** Instruction shown when they can spend it. */
  prompt: string;
  /** Needs a target at night. */
  targeted: boolean;
  /** Spent during the night phase (as opposed to the vote). */
  night: boolean;
  traitorOnly: boolean;
}

export const ITEMS: Record<ItemKind, ItemInfo> = {
  shield: {
    kind: 'shield',
    emoji: '🛡',
    name: 'Shield',
    blurb: 'Once, protect one person from the traitors for a night. Yourself counts.',
    prompt: 'Who do you shield tonight?',
    targeted: true,
    night: true,
    traitorOnly: false,
  },
  doubleVote: {
    kind: 'doubleVote',
    emoji: '🎤',
    name: 'Double Vote',
    blurb: 'Once, your vote counts twice. Spend it at any vote.',
    prompt: 'Make this vote count twice?',
    targeted: false,
    night: false,
    traitorOnly: false,
  },
  spyCamera: {
    kind: 'spyCamera',
    emoji: '🕵',
    name: 'Spy Camera',
    blurb: 'Once, watch one person overnight and learn who visited them.',
    prompt: 'Who do you watch tonight?',
    targeted: true,
    night: true,
    traitorOnly: false,
  },
  detectiveScan: {
    kind: 'detectiveScan',
    emoji: '🔎',
    name: 'Detective Scan',
    blurb: 'Once, scan one person and learn whether they are a traitor.',
    prompt: 'Who do you scan tonight?',
    targeted: true,
    night: true,
    traitorOnly: false,
  },
  fakeEvidence: {
    kind: 'fakeEvidence',
    emoji: '🎭',
    name: 'Fake Evidence',
    blurb: 'Once, frame an innocent. Any scan of them tonight comes back TRAITOR.',
    prompt: 'Who do you frame tonight?',
    targeted: true,
    night: true,
    traitorOnly: true,
  },
};

export const itemInfo = (kind: ItemKind): ItemInfo => ITEMS[kind];
