// src/components/ui/GameOverlay.tsx
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
    const showIntroScreen = useGameStore((state) => state.showIntroScreen);
    const coinCount = useGameStore((state) => state.coinCount);
    const lives = useGameStore((state) => state.lives);
    const gameState = useGameStore((state) => state.gameState);
    const activePowerUps = useGameStore((state) => state.activePowerUps);

    // Match timer state
    const matchTimeRemaining = useGameStore((state) => state.matchTimeRemaining);
    const isMatchTimerActive = useGameStore((state) => state.isMatchTimerActive);

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Show intro/loading screen until user taps start
    if (showIntroScreen) {
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

            {/* Match Timer Display - Top Center */}
            {isMatchTimerActive && (
                <div className={`match-timer ${matchTimeRemaining <= 10 ? 'timer-warning' : ''}`}>
                    ⏱️ {formatTime(matchTimeRemaining)}
                </div>
            )}

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
                    <div className="gameover-text">
                        {matchTimeRemaining <= 0 ? "TIME'S UP!" : "GAME OVER"}
                    </div>
                    <div className="gameover-subtext">Press R to restart</div>
                    <button
                        className="reset-button"
                        onClick={() => {
                            // Hard reload the page
                            window.location.reload();
                        }}
                        style={{
                            marginTop: '20px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            backgroundColor: 'rgba(255, 50, 50, 0.9)',
                            color: 'white',
                            border: '2px solid rgba(255, 255, 255, 0.5)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                        }}
                    >
                        🔄 Restart
                    </button>
                </div>
            )}

            {/* Victory Screen - Conditional */}
            {gameState === 'victory' && (
                <div className="victory-overlay">
                    <div className="victory-text">VICTORY!</div>
                    <div className="victory-subtext">
                        You survived with {coinCount} coins!
                    </div>
                    <button
                        className="reset-button victory-button"
                        onClick={() => {
                            // Hard reload the page
                            window.location.reload();
                        }}
                        style={{
                            marginTop: '20px',
                            padding: '12px 24px',
                            fontSize: '16px',
                            backgroundColor: 'rgba(50, 200, 50, 0.9)',
                            color: 'white',
                            border: '3px solid rgba(255, 215, 0, 0.8)',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                            boxShadow: '0 6px 12px rgba(0,0,0,0.4), 0 0 20px rgba(255, 215, 0, 0.3)',
                        }}
                    >
                        🏆 Play Again
                    </button>
                </div>
            )}
        </div>
    );
};

