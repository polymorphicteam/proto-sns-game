import React, { useCallback } from 'react';
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { loadFireworksPreset } from "tsparticles-preset-fireworks";
import { Engine } from "tsparticles-engine";

export const FireworksOverlay: React.FC = () => {
    const particlesInit = useCallback(async (engine: Engine) => {
        await loadSlim(engine);
        await loadFireworksPreset(engine);
    }, []);

    const options = {
        fullScreen: { enable: false },
        background: { color: "transparent" },
        backgroundMask: { enable: false },
        fpsLimit: 60,
        particles: {
            number: { value: 0 },
            move: {
                outModes: { default: "destroy" as const },
                trail: {
                    enable: true,
                    length: 10,
                    fillColor: "transparent"
                }
            }
        },
        emitters: {
            direction: "top",
            life: { count: 0, duration: 0.1, delay: 0.6 },
            rate: { delay: 0.05, quantity: 1 },
            size: { width: 80, height: 0, mode: "percent" },
            // MODIFICA: Alziamo il punto di lancio al 40% dal fondo (quindi coordinata 60)
            position: { x: 50, y: 60 },
            angle: { min: -30, max: 30 }
        },
        preset: "fireworks",
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
        }}>
            <Particles
                id="tsparticles"
                init={particlesInit}
                options={options}
                // FIX: Stile inline forzato per espandere il canvas al 100% del padre
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'transparent'
                }}
            />
        </div>
    );
};
