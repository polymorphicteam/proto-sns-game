import React from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * GameOverlay Component
 * 
 * Main React overlay that displays game UI elements on top of the Babylon.js canvas.
 * This component reads state from the Zustand store and renders UI accordingly.
 * 
 * Design principles:
 * - Uses pointer-events: none to allow clicks to pass through to the canvas
 * - Positioned absolutely to overlay the game canvas
 * - Subscribes to Zustand store for automatic updates when state changes
 */
export const GameOverlay: React.FC = () => {
    // Subscribe to coin count from Zustand store
    // This will automatically re-render when the coin count changes
    const coinCount = useGameStore((state) => state.coinCount);

    return (
        <div style={styles.container}>
            {/* Coin Counter */}
            <div style={styles.coinCounter}>
                <span style={styles.coinIcon}>🟡</span>
                <span style={styles.coinCount}>{coinCount}</span>
            </div>

            {/* Future UI elements can be added here */}
            {/* Example: health bar, score, timer, etc. */}
        </div>
    );
};

/**
 * Inline styles for the overlay
 * Using inline styles to avoid needing a separate CSS file
 */
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Critical: allows clicks to pass through to canvas
        userSelect: 'none',
        zIndex: 1000,
    },
    coinCounter: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'white',
        fontFamily: 'sans-serif',
        fontSize: '24px',
        fontWeight: 'bold',
        textShadow: '2px 2px 0 #000',
    },
    coinIcon: {
        fontSize: '24px',
    },
    coinCount: {
        fontSize: '24px',
    },
};
