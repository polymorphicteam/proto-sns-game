import React from 'react';
import { useGameStore } from '../../store/gameStore';
import '../../styles/main.css';

/**
 * CountdownOverlay Component
 * 
 * Displays animated countdown numbers (3, 2, 1, GO!) with zoom effect.
 * Numbers fly toward the screen with easing animation.
 */
export const CountdownOverlay: React.FC = () => {
    const countdownValue = useGameStore((state) => state.countdownValue);

    if (countdownValue === null) {
        return null;
    }

    // Display "GO!" for value 0, otherwise show the number
    const displayText = countdownValue === 0 ? "GO!" : countdownValue.toString();
    const isGo = countdownValue === 0;

    return (
        <div className="countdown-overlay">
            {/* Key forces re-render and animation restart on value change */}
            <div
                key={countdownValue}
                className={`countdown-number ${isGo ? 'countdown-go' : ''}`}
            >
                {displayText}
            </div>
        </div>
    );
};
