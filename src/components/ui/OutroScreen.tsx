import React, { useEffect } from 'react';
import { FireworksOverlay } from './vfx/FireworksOverlay';

/**
 * CONFIGURAZIONE VIDEO
 * I valori di offset sono ora in PERCENTUALE rispetto al contenitore
 */
const VIDEO_CONFIG = {
    scale: 0.8,
    offsetX: 0,    // % orizzontale
    offsetY: 18    // % verticale (approx 150px su schermi medi)
};

/**
 * CONFIGURAZIONE BANDIERA
 * I valori di offset sono ora in PERCENTUALE rispetto al contenitore
 */
const FLAG_CONFIG = {
    scale: 0.6,
    offsetX: -14,  // % orizzontale (approx -70px)
    offsetY: -28   // % verticale (approx -240px)
};

/**
 * CONFIGURAZIONE PULSANTE RESTART
 * Qui puoi regolare tutto a tuo piacimento
 */
const BUTTON_CONFIG = {
    width: '50%',       // Larghezza in % così scala con lo schermo
    top: '5%',          // Distanza dal bordo superiore
    left: '70%',        // Centratura orizzontale
    zIndex: 10          // Deve stare sopra il video
};

export const OutroScreen: React.FC = () => {

    useEffect(() => {
        // Stop BabylonJS render loop immediately to save resources
        // and prevent interference with React overlay
        console.log("🛑 Dispatching stopRenderLoop for Victory Screen");
        window.dispatchEvent(new Event("stopRenderLoop"));
    }, []);

    return (
        <div className="outro-screen">
            {/* Livello 1: VFX */}
            <FireworksOverlay />

            {/* Livello 1.5: Overlay Image */}
            <img
                src="/OutroOverlay.png"
                alt="Outro Overlay"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    pointerEvents: 'none',
                    zIndex: 2 // Layer 2: Above VFX
                }}
            />

            {/* Livello 2.5: Flag Video */}
            <video
                src="/flag.webm"
                autoPlay
                muted
                loop
                playsInline
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    zIndex: 3, // Layer 3: Above Overlay
                    // Translate usa ora le percentuali (%) invece dei px
                    transform: `translate(calc(-50% + ${FLAG_CONFIG.offsetX}%), calc(-50% + ${FLAG_CONFIG.offsetY}%)) scale(${FLAG_CONFIG.scale})`
                }}
            />

            {/* Livello 2: Video */}
            <video
                src="/DanceOutro.webm"
                autoPlay
                muted
                playsInline
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    zIndex: 4, // Layer 4: Above Flag
                    // Translate usa ora le percentuali (%) invece dei px
                    transform: `translate(calc(-50% + ${VIDEO_CONFIG.offsetX}%), calc(-50% + ${VIDEO_CONFIG.offsetY}%)) scale(${VIDEO_CONFIG.scale})`
                }}
            />

            {/* Livello 3: Play Again Button */}
            <img
                src="/PlayAgainButton.png"
                alt="Restart"
                onClick={() => window.location.reload()}
                style={{
                    position: 'absolute',
                    // Posizionamento
                    top: BUTTON_CONFIG.top,
                    left: BUTTON_CONFIG.left,
                    transform: 'translateX(-50%)', // Centra perfettamente l'immagine rispetto alla sua larghezza

                    // Dimensioni
                    width: BUTTON_CONFIG.width,
                    height: 'auto', // Mantiene le proporzioni originali dell'immagine

                    // Interazione e Stile
                    cursor: 'pointer',
                    zIndex: BUTTON_CONFIG.zIndex, // Layer 3 (10): Topmost
                    pointerEvents: 'auto' // Fondamentale per ricevere il click
                }}
            />
        </div>
    );
};