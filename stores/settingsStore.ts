
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSettings, SessionHistoryItem, ColorTheme, QualityTier, Language, SoundPack, BreathingType } from '../types';

type SettingsState = {
  userSettings: UserSettings;
  history: SessionHistoryItem[];
  hasSeenOnboarding: boolean;

  // Actions
  toggleSound: () => void;
  toggleHaptic: () => void;
  setHapticStrength: (s: UserSettings['hapticStrength']) => void;
  setTheme: (t: ColorTheme) => void;
  setQuality: (q: QualityTier) => void;
  setReduceMotion: (v: boolean) => void;
  toggleTimer: () => void;
  setLanguage: (l: Language) => void;
  setSoundPack: (p: SoundPack) => void;
  completeOnboarding: () => void;
  clearHistory: () => void;
  setLastUsedPattern: (p: BreathingType) => void;
  
  // Logic
  registerSessionComplete: (durationSec: number, patternId: BreathingType, cycles: number) => void;
};

const getTodayString = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      userSettings: {
        soundEnabled: true,
        hapticEnabled: true,
        hapticStrength: 'medium',
        theme: 'neutral',
        quality: 'auto',
        reduceMotion: false,
        showTimer: true,
        language: 'en',
        soundPack: 'musical',
        streak: 0,
        lastBreathDate: '',
        lastUsedPattern: '4-7-8',
      },
      history: [],
      hasSeenOnboarding: false,

      toggleSound: () => set((s) => ({ userSettings: { ...s.userSettings, soundEnabled: !s.userSettings.soundEnabled } })),
      toggleHaptic: () => set((s) => ({ userSettings: { ...s.userSettings, hapticEnabled: !s.userSettings.hapticEnabled } })),
      setHapticStrength: (s) => set((s) => ({ userSettings: { ...s.userSettings, hapticStrength: s } })),
      setTheme: (t) => set((s) => ({ userSettings: { ...s.userSettings, theme: t } })),
      setQuality: (q) => set((s) => ({ userSettings: { ...s.userSettings, quality: q } })),
      setReduceMotion: (v) => set((s) => ({ userSettings: { ...s.userSettings, reduceMotion: v } })),
      toggleTimer: () => set((s) => ({ userSettings: { ...s.userSettings, showTimer: !s.userSettings.showTimer } })),
      setLanguage: (l) => set((s) => ({ userSettings: { ...s.userSettings, language: l } })),
      setSoundPack: (p) => set((s) => ({ userSettings: { ...s.userSettings, soundPack: p } })),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      clearHistory: () => set({ history: [] }),
      setLastUsedPattern: (p) => set((s) => ({ userSettings: { ...s.userSettings, lastUsedPattern: p } })),

      registerSessionComplete: (durationSec, patternId, cycles) => {
        const state = get();
        
        // 1. History
        let newHistory = state.history;
        if (durationSec > 10) {
            const newItem: SessionHistoryItem = {
                id: Date.now().toString() + Math.random().toString().slice(2, 6),
                timestamp: Date.now(),
                durationSec,
                patternId,
                cycles
            };
            // Limit history to 100 items to prevent storage quota issues
            newHistory = [newItem, ...state.history].slice(0, 100);
        }

        // 2. Streak
        let newStreak = state.userSettings.streak;
        let newLastDate = state.userSettings.lastBreathDate;
        
        if (durationSec > 30) {
            const today = getTodayString();
            const yesterday = getYesterdayString();
            
            if (newLastDate === today) {
                // Already breathed today
            } else if (newLastDate === yesterday) {
                newStreak += 1;
                newLastDate = today;
            } else {
                newStreak = 1;
                newLastDate = today;
            }
        }

        set({
            history: newHistory,
            userSettings: {
                ...state.userSettings,
                streak: newStreak,
                lastBreathDate: newLastDate,
                // Update last used on completion as well to reinforce preference
                lastUsedPattern: patternId 
            }
        });
      }
    }),
    {
      name: 'zenb-settings-storage',
      partialize: (state) => ({ 
        userSettings: state.userSettings, 
        hasSeenOnboarding: state.hasSeenOnboarding,
        history: state.history
      }),
    }
  )
);