
import React, { useEffect, useMemo, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { nextPhaseSkipZero, isCycleBoundary, isPatternValid } from '../services/phaseMachine';
import { BreathPhase, UserSettings } from '../types';
import { playCue } from '../services/audio';
import { hapticPhase } from '../services/haptics';

type EngineRefs = {
  progressRef: React.MutableRefObject<number>;
};

function phaseToCueType(phase: BreathPhase): 'inhale' | 'exhale' | 'hold' {
  if (phase === 'holdIn' || phase === 'holdOut') return 'hold';
  return phase;
}

export function useBreathEngine(): EngineRefs {
  // Selective subscriptions for Session State
  const isActive = useSessionStore((s) => s.isActive);
  const isPaused = useSessionStore((s) => s.isPaused);
  const phase = useSessionStore((s) => s.phase);
  const currentPattern = useSessionStore((s) => s.currentPattern);
  const setPhase = useSessionStore((s) => s.setPhase);
  const incrementCycle = useSessionStore((s) => s.incrementCycle);
  
  // Subscribe to full userSettings object from Settings Store
  const storeUserSettings = useSettingsStore((s) => s.userSettings);

  // Refs for internal engine state (mutable, no re-renders)
  const settingsRef = useRef<UserSettings>(storeUserSettings);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const wasHiddenRef = useRef<boolean>(false);
  const progressRef = useRef<number>(0);

  // Keep settings fresh in ref without triggering effects
  useEffect(() => {
    settingsRef.current = storeUserSettings;
  }, [storeUserSettings]);

  const stopRaf = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const triggerCuesForPhase = async (p: BreathPhase, duration: number) => {
    const st = settingsRef.current;
    const cueType = phaseToCueType(p);
    
    // Fire haptic
    hapticPhase(st.hapticEnabled, st.hapticStrength, cueType);
    
    // Fire audio (fire-and-forget)
    playCue(cueType, st.soundEnabled, st.soundPack, duration, st.language).catch(() => {});
  };

  // Visibility Logic: "Soft Resume" to avoid phase jumps
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        wasHiddenRef.current = true;
        pausedAtRef.current = performance.now();
        stopRaf();
      } else {
        if (wasHiddenRef.current && isActive && !isPaused) {
          wasHiddenRef.current = false;
          // Soft resume: reset the clock for the CURRENT phase
          startTimeRef.current = performance.now(); 
          progressRef.current = 0; 
          rafIdRef.current = requestAnimationFrame(loop);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isActive, isPaused]);

  const loop = (now: number) => {
    const duration = currentPattern.timings[phase];

    // Fail-safe
    if (!isPatternValid(currentPattern)) {
      progressRef.current = 0;
      stopRaf();
      return;
    }

    const elapsedSec = (now - startTimeRef.current) / 1000;
    const denom = Math.max(duration, 1e-6);
    // Clamp 0..1
    progressRef.current = Math.max(0, Math.min(elapsedSec / denom, 1));

    // Phase Transition
    if (elapsedSec >= duration) {
      const next = nextPhaseSkipZero(phase, currentPattern);
      const nextDuration = currentPattern.timings[next];
      
      if (isCycleBoundary(next)) {
        incrementCycle();
      }

      setPhase(next); // This triggers React render for UI text, but not the loop itself
      
      // Reset clock immediately for next frame
      startTimeRef.current = performance.now();
      progressRef.current = 0;

      // Trigger cues
      triggerCuesForPhase(next, nextDuration);
      
      // Continue loop
      rafIdRef.current = requestAnimationFrame(loop);
      return;
    }

    rafIdRef.current = requestAnimationFrame(loop);
  };

  // Main Effect to manage the loop lifecycle
  useEffect(() => {
    // 1. Inactive
    if (!isActive) {
      stopRaf();
      progressRef.current = 0;
      startTimeRef.current = 0;
      pausedAtRef.current = 0;
      return;
    }

    // 2. Paused
    if (isPaused) {
      pausedAtRef.current = performance.now();
      stopRaf();
      return;
    }

    // 3. Active & Running
    // Resume from pause or start fresh
    if (pausedAtRef.current > 0 && startTimeRef.current > 0) {
      const pausedDur = performance.now() - pausedAtRef.current;
      startTimeRef.current += pausedDur;
      pausedAtRef.current = 0;
    } else {
      // Brand new phase start
      startTimeRef.current = performance.now();
      progressRef.current = 0;
      // Trigger initial cue for the very first phase start
      triggerCuesForPhase(phase, currentPattern.timings[phase]);
    }

    rafIdRef.current = requestAnimationFrame(loop);

    return () => stopRaf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isPaused, phase, currentPattern]);

  return useMemo(() => ({ progressRef }), []);
}
