
export type BreathPhase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';
export type CueType = 'inhale' | 'exhale' | 'hold' | 'finish';
export type BreathingType = '4-7-8' | 'box' | 'calm';
export type ColorTheme = 'warm' | 'cool' | 'neutral';
export type Language = 'en' | 'vi';
export type SoundPack = 'musical' | 'bells' | 'breath' | 'voice-en' | 'voice-vi' | 'voice-12';

// Discriminated Union for Quality Configuration
export type QualityTier = 'auto' | 'low' | 'medium' | 'high';

export type QualityConfig = 
  | { tier: 'auto'; dpr: number; segments: number }
  | { tier: 'low'; dpr: 1; segments: 48 }
  | { tier: 'medium'; dpr: 1.5; segments: 72 }
  | { tier: 'high'; dpr: 2; segments: 128 };

export type UserSettings = {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  hapticStrength: 'light' | 'medium' | 'heavy';
  theme: ColorTheme;
  quality: QualityTier;
  reduceMotion: boolean;
  showTimer: boolean;
  language: Language; 
  soundPack: SoundPack;
  streak: number;
  lastBreathDate: string; // ISO Date string (YYYY-MM-DD)
  lastUsedPattern: BreathingType;
};

export type SessionHistoryItem = {
  id: string;
  timestamp: number;
  durationSec: number;
  patternId: BreathingType;
  cycles: number;
};

// Strict SessionStats (Removed display label, added strict patternId)
export type SessionStats = {
  durationSec: number;
  cyclesCompleted: number;
  patternId: BreathingType;
  timestamp: number;
};

export type BreathPattern = {
  id: BreathingType;
  label: string;
  tag: string;
  description: string;
  timings: Record<BreathPhase, number>; // seconds
  colorTheme: ColorTheme;
  recommendedCycles?: number;
};

export const BREATHING_PATTERNS: Record<string, BreathPattern> = {
  '4-7-8': {
    id: '4-7-8',
    label: 'Relax',
    tag: 'Sleep & Anxiety',
    description: 'A natural tranquilizer for the nervous system.',
    timings: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
    colorTheme: 'warm',
    recommendedCycles: 4,
  },
  box: {
    id: 'box',
    label: 'Focus',
    tag: 'Concentration',
    description: 'Used by Navy SEALs to heighten performance.',
    timings: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
    colorTheme: 'neutral',
    recommendedCycles: 6,
  },
  calm: {
    id: 'calm',
    label: 'Balance',
    tag: 'Coherence',
    description: 'Restores balance to your heart rate variability.',
    timings: { inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
    colorTheme: 'cool',
    recommendedCycles: 8,
  },
};