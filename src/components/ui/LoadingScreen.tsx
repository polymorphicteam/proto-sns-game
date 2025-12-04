import React from 'react';
import '../../styles/main.css';

/**
 * LoadingScreen Component
 * 
 * Displays a full-screen loading overlay with animated spinner.
 * Shows while game assets are loading.
 */
export const LoadingScreen: React.FC = () => {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading...</div>
            </div>
        </div>
    );
};
