import { create } from 'zustand';

/**
 * Game state interface
 * Contains all UI-related state that needs to be shared between Babylon and React
 */
export interface GameState {
    coinCount: number;
}

/**
 * Game store actions interface
 * Defines all actions that can modify the game state
 */
interface GameActions {
    updateCoinCount: (count: number) => void;
    incrementCoinCount: (amount: number) => void;
    resetCoinCount: () => void;
}

/**
 * Combined store type
 */
type GameStore = GameState & GameActions;

/**
 * Zustand store for game state
 * This is the single source of truth for all UI state
 * 
 * Usage in Babylon:
 *   import { useGameStore } from './store/gameStore';
 *   useGameStore.getState().updateCoinCount(10);
 * 
 * Usage in React:
 *   import { useGameStore } from './store/gameStore';
 *   const coinCount = useGameStore((state) => state.coinCount);
 */
export const useGameStore = create<GameStore>((set) => ({
    // Initial state
    coinCount: 0,

    // Actions
    updateCoinCount: (count: number) => set({ coinCount: count }),

    incrementCoinCount: (amount: number) =>
        set((state) => ({ coinCount: state.coinCount + amount })),

    resetCoinCount: () => set({ coinCount: 0 }),
}));
