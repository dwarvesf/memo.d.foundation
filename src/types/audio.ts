export type SoundEffectType =
  | 'paperRubbing'
  | 'sharpClick'
  | 'slide'
  | 'pop'
  | 'buttonUp'
  | 'buttonDown';

export type ButtonSoundType = 'pop' | 'sharp-click' | 'button-toggle' | 'none';

export type HoverSoundType = 'slide' | 'none';

export interface AudioPool {
  [key: string]: HTMLAudioElement[];
}

export interface SoundPreferences {
  enabled: boolean;
  volume: number;
}

export interface SoundContextType {
  isSoundEnabled: boolean;
  setIsSoundEnabled: (enabled: boolean) => void;
  playPaperRubbing: () => void;
  playSharpClick: () => void;
  playSlide: () => void;
  playPop: () => void;
  playButtonUp: () => void;
  playButtonDown: () => void;
  toggleSound: () => void;
}
