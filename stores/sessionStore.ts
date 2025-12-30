
import { create } from 'zustand';
import { BREATHING_PATTERNS, BreathPattern, BreathPhase, BreathingType, SessionStats } from '../types';
import { useSettingsStore } from './settingsStore';

type SessionState = {
  isActive: boolean;
  isPaused: boolean;
  currentPattern: BreathPattern;
  phase: BreathPhase;
  cycleCount: number;
  sessionStartTime: number;
  lastSessionStats: SessionStats | null;

  // Actions
  startSession: (type: BreathingType) => void;
  stopSession: () => void;
  finishSession: () => void;
  togglePause: () => void;
  setPhase: (phase: BreathPhase) => void;
  incrementCycle: () => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  isPaused: false,
  currentPattern: BREATHING_PATTERNS['4-7-8'],
  phase: 'inhale',
  cycleCount: 0,
  sessionStartTime: 0,
  lastSessionStats: null,

  startSession: (type) =>
    set({
      isActive: true,
      isPaused: false,
      currentPattern: BREATHING_PATTERNS[type],
      phase: 'inhale',
      cycleCount: 0,
      sessionStartTime: Date.now(),
      lastSessionStats: null,
    }),

  stopSession: () => set({ isActive: false, isPaused: false, cycleCount: 0, phase: 'inhale', sessionStartTime: 0 }),
  
  finishSession: () => {
    const state = get();
    const durationSec = Math.floor((Date.now() - state.sessionStartTime) / 1000);
    
    // Update persisted stats via settings store
    useSettingsStore.getState().registerSessionComplete(
        durationSec, 
        state.currentPattern.id, 
        state.cycleCount
    );

    // Set ephemeral stats for summary modal
    set({
      isActive: false,
      isPaused: false,
      sessionStartTime: 0,
      lastSessionStats: {
        durationSec,
        cyclesCompleted: state.cycleCount,
        patternId: state.currentPattern.id,
        timestamp: Date.now()
      }
    });
    
    // Trigger summary modal via UI store (must be handled by consumer or UI store listening to changes)
    // NOTE: In this architecture, App.tsx or UI Store will observe lastSessionStats changes
  },

  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  
  setPhase: (phase) => set({ phase }),
  
  incrementCycle: () => set((s) => ({ cycleCount: s.cycleCount + 1 })),
}));
