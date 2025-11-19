import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameOverlay } from './components/GameOverlay';


/**
 * Initialize React Overlay
 * 
 * Creates a DOM element overlay and mounts the React application to it.
 * This overlay sits on top of the Babylon.js canvas and matches its exact dimensions.
 * 
 * The overlay is configured to:
 * - Match canvas dimensions exactly
 * - Be positioned absolutely to align with the canvas
 * - Have pointer-events: none to allow game inputs to pass through
 * - Have a high z-index to always be on top
 * - Automatically resize when the canvas resizes
 */
export function initReactOverlay(): void {
    // Get the Babylon canvas
    const canvas = document.getElementById('game-canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        console.error('❌ Canvas not found - cannot initialize React overlay');
        return;
    }

    // Create overlay container
    const overlayContainer = document.createElement('div');
    overlayContainer.id = 'react-overlay';

    // Style the overlay to match canvas dimensions
    overlayContainer.style.position = 'fixed';
    overlayContainer.style.pointerEvents = 'none'; // Critical: allows clicks to pass through
    overlayContainer.style.zIndex = '1000';

    // Function to sync overlay dimensions with canvas
    const syncOverlayWithCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        overlayContainer.style.top = `${rect.top}px`;
        overlayContainer.style.left = `${rect.left}px`;
        overlayContainer.style.width = `${rect.width}px`;
        overlayContainer.style.height = `${rect.height}px`;
    };

    // Initial sync
    syncOverlayWithCanvas();

    // Append to body
    document.body.appendChild(overlayContainer);

    // Listen for window resize to keep overlay synced with canvas
    const resizeObserver = new ResizeObserver(() => {
        syncOverlayWithCanvas();
    });
    resizeObserver.observe(canvas as unknown as Element);


    // Also listen to window resize as a fallback
    window.addEventListener('resize', syncOverlayWithCanvas);

    // Mount React app
    const root = createRoot(overlayContainer);
    root.render(
        <React.StrictMode>
            <GameOverlay />
        </React.StrictMode>
    );

    console.log('✅ React overlay initialized and synced with canvas');
}
