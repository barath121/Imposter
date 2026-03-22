
export interface Category {
  id: string;
  name: string;
  words: string[];
  isCustom?: boolean;
}

export interface Player {
  id: number;
  name: string;
  word: string;
  isImposter: boolean;
  hasSeenWord: boolean;
}

export enum GameState {
  SETUP = 'SETUP',
  PRE_REVEAL = 'PRE_REVEAL',
  REVEALING = 'REVEALING',
  DISCUSSION = 'DISCUSSION',
  MANAGE_CUSTOM = 'MANAGE_CUSTOM',
  PICK_WORDS = 'PICK_WORDS'
}
