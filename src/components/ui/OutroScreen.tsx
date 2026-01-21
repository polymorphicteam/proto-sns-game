import React from 'react';

/**
 * CONFIGURAZIONE VIDEO
 * Modifica questi valori per aggiustare posizione e grandezza
 */
const VIDEO_CONFIG = {
    scale: 0.6,        // 1.0 = grandezza normale, 1.2 = 20% più grande, 0.8 = 20% più piccolo
    offsetX: 0,        // Spostamento orizzontale in px (positivo = destra, negativo = sinistra)
    offsetY: 150        // Spostamento verticale in px (positivo = basso, negativo = alto)
};

/**
 * OutroScreen Component
 * 
 * Displays a full-screen static image when the player wins (timer runs out).
 * Covers the 3D scene completely.
 * Includes a transparent video overlay.
 */
export const OutroScreen: React.FC = () => {
    return (
        <div className="outro-screen">
            <video
                src="/DanceOutro.webm"
                autoPlay
                muted
                playsInline
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    // Non toccare width/height se vuoi mantenere l'aspect ratio originale del video
                    // Usa width: '100%' solo se vuoi forzare la larghezza container
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain', // 'contain' per vedere tutto il video senza tagli
                    pointerEvents: 'none',
                    // La trasformazione combina il centraggio (-50%, -50%) con i tuoi aggiustamenti personalizzati
                    transform: `translate(calc(-50% + ${VIDEO_CONFIG.offsetX}px), calc(-50% + ${VIDEO_CONFIG.offsetY}px)) scale(${VIDEO_CONFIG.scale})`
                }}
            />
        </div>
    );
};
