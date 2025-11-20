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

    // Subscribe to game state from Zustand store
    // Components will automatically re-render when these values change
    const coinCount = useGameStore((state) => state.coinCount);
    const lives = useGameStore((state) => state.lives);
    const gameState = useGameStore((state) => state.gameState);
    const activePowerUps = useGameStore((state) => state.activePowerUps);

    return (
        <div style={styles.container}>
            {/* Top HUD */}
            <div style={styles.topHud}>
                {/* Lives Counter - Top Left */}
                <div style={styles.livesContainer}>
                    <span style={styles.livesLabel}>Lives:</span>
                    <div style={styles.heartsContainer}>
                        {Array.from({ length: Math.max(0, lives) }).map((_, index) => (
                            <span key={index} style={styles.heart}>❤️</span>
                        ))}
                        {/* Show empty hearts for lost lives */}
                        {Array.from({ length: Math.max(0, 3 - lives) }).map((_, index) => (
                            <span key={`empty-${index}`} style={styles.emptyHeart}>🖤</span>
                        ))}
                    </div>
                </div>

                {/* Coin Counter - Top Right */}
                <div style={styles.coinCounter}>
                    <span style={styles.coinIcon}>🟡</span>
                    <span style={styles.coinCount}>{coinCount}</span>
                </div>
            </div>

            {/* Power-ups Display - Prepared for future use */}
            {activePowerUps.length > 0 && (
                <div style={styles.powerUpsContainer}>
                    {activePowerUps.map((powerUp) => (
                        <div key={powerUp.type} style={styles.powerUpIcon}>
                            ⚡ {powerUp.type}
                        </div>
                    ))}
                </div>
            )}

            {/* Game Over Screen - Conditional */}
            {gameState === 'gameover' && (
                <div style={styles.gameOverOverlay}>
                    <div style={styles.gameOverText}>GAME OVER</div>
                    <div style={styles.gameOverSubtext}>Press R to restart</div>
                </div>
            )}
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
    topHud: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        padding: '20px',
    },
    // Lives Display (Top Left)
    livesContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    livesLabel: {
        color: 'white',
        fontFamily: 'sans-serif',
        fontSize: '20px',
        fontWeight: 'bold',
        textShadow: '2px 2px 0 #000',
    },
    heartsContainer: {
        display: 'flex',
        gap: '5px',
    },
    heart: {
        fontSize: '24px',
        filter: 'drop-shadow(2px 2px 0 #000)',
    },
    emptyHeart: {
        fontSize: '24px',
        opacity: 0.3,
        filter: 'drop-shadow(2px 2px 0 #000)',
    },
    // Coin Counter (Top Right)
    coinCounter: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    coinIcon: {
        fontSize: '24px',
    },
    coinCount: {
        color: 'white',
        fontFamily: 'sans-serif',
        fontSize: '24px',
        fontWeight: 'bold',
        textShadow: '2px 2px 0 #000',
    },
    // Power-ups Display (Top Center) - for future
    powerUpsContainer: {
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px',
    },
    powerUpIcon: {
        padding: '8px 16px',
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        border: '2px solid gold',
        borderRadius: '8px',
        color: 'white',
        fontFamily: 'sans-serif',
        fontSize: '16px',
        fontWeight: 'bold',
        textShadow: '1px 1px 0 #000',
    },
    // Game Over Screen
    gameOverOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'auto', // Allow interactions for game over screen
    },
    gameOverText: {
        color: '#ff4444',
        fontFamily: 'sans-serif',
        fontSize: '64px',
        fontWeight: 'bold',
        textShadow: '4px 4px 0 #000',
        marginBottom: '20px',
    },
    gameOverSubtext: {
        color: 'white',
        fontFamily: 'sans-serif',
        fontSize: '24px',
        textShadow: '2px 2px 0 #000',
    },
};
