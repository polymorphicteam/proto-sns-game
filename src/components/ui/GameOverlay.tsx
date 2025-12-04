import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { LoadingScreen } from './LoadingScreen';
import { CountdownOverlay } from './CountdownOverlay';
import '../../styles/main.css';

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
    const isLoading = useGameStore((state) => state.isLoading);
    const coinCount = useGameStore((state) => state.coinCount);
    const lives = useGameStore((state) => state.lives);
    const gameState = useGameStore((state) => state.gameState);
    const activePowerUps = useGameStore((state) => state.activePowerUps);

    // Show loading screen while assets are loading
    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="game-overlay-container">
            {/* Countdown Overlay */}
            <CountdownOverlay />
            <div className="top-hud">
                {/* Lives Counter - Top Left */}
                <div className="lives-container">
                    <span className="lives-label">Lives:</span>
                    <div className="hearts-container">
                        {Array.from({ length: Math.max(0, lives) }).map((_, index) => (
                            <span key={index} className="heart">❤️</span>
                        ))}
                        {/* Show empty hearts for lost lives */}
                        {Array.from({ length: Math.max(0, 3 - lives) }).map((_, index) => (
                            <span key={`empty-${index}`} className="empty-heart">🖤</span>
                        ))}
                    </div>
                </div>

                {/* Coin Counter - Top Right */}
                <div className="coin-counter">
                    <span className="coin-icon">🟡</span>
                    <span className="coin-count">{coinCount}</span>
                </div>
            </div>

            {/* Power-ups Display - Prepared for future use */}
            {activePowerUps.length > 0 && (
                <div className="powerups-container">
                    {activePowerUps.map((powerUp) => (
                        <div key={powerUp.type} className="powerup-icon">
                            ⚡ {powerUp.type}
                        </div>
                    ))}
                </div>
            )}

            {/* Game Over Screen - Conditional */}
            {gameState === 'gameover' && (
                <div className="gameover-overlay">
                    <div className="gameover-text">GAME OVER</div>
                    <div className="gameover-subtext">Press R to restart</div>
                </div>
            )}
        </div>
    );
};

