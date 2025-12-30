
/**
 * DEPRECATED
 * 
 * This monolithic store has been split into:
 * - stores/sessionStore.ts (Ephemeral session state)
 * - stores/settingsStore.ts (Persisted user settings)
 * - stores/uiStore.ts (UI state)
 * 
 * Please import from specific stores directly.
 */

export const useBreathStore = () => {
    throw new Error("useBreathStore is deprecated. Use useSessionStore, useSettingsStore, or useUIStore.");
}
