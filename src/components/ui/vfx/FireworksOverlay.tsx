import React, { useCallback } from 'react';
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { loadFireworksPreset } from "tsparticles-preset-fireworks";
import { Engine } from "tsparticles-engine";

export const FireworksOverlay: React.FC = () => {
    const particlesInit = useCallback(async (engine: Engine) => {
        await loadSlim(engine);
        await loadFireworksPreset(engine); // Restore this to load necessary plugins
    }, []);

    const options = {
        fullScreen: { enable: false },
        background: { color: "transparent" },
        fpsLimit: 120,
        interactivity: {
            detectsOn: "window" as const,
            events: {
                onClick: { enable: true, mode: "push" },
                resize: true,
            },
        },
        emitters: {
            direction: "top",
            life: {
                count: 0,
                duration: 0.1,
                delay: 0.3,
            },
            rate: {
                delay: 0.1,
                quantity: 1,
            },
            size: {
                width: 80,
                height: 0,
                mode: "percent" as const,
            },
            position: {
                x: 50,
                y: 60,
            },
        },
        particles: {
            number: { value: 0 },
            color: { value: "#fff" },
            shape: { type: "circle" },
            opacity: { value: 1 },
            size: {
                value: { min: 1, max: 2 },
                animation: {
                    enable: true,
                    speed: 5,
                    sync: false,
                    startValue: "min" as const,
                    destroy: "max" as const,
                },
            },
            life: {
                count: 1,
                duration: {
                    value: { min: 1, max: 2 },
                },
            },
            move: {
                enable: true,
                gravity: {
                    enable: true,
                    acceleration: 9.81,
                    inverse: true, // Go UP
                },
                speed: { min: 10, max: 20 },
                direction: "top" as const,
                outModes: {
                    default: "destroy" as const,
                    top: "none" as const,
                },
                trail: {
                    enable: true,
                    length: 20, // Longer trail for rocket
                    fillColor: "transparent",
                },
            },
            destroy: {
                mode: "split" as const,
                split: {
                    count: 1,
                    factor: { value: 0.33 },
                    rate: {
                        value: { min: 100, max: 200 }, // MORE particles
                    },
                    particles: {
                        stroke: {
                            width: 0,
                            color: "#000000",
                        },
                        color: {
                            value: ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ffffff"],
                        },
                        shape: { type: "circle" },
                        opacity: {
                            value: { min: 0.1, max: 1 },
                            animation: {
                                enable: true,
                                speed: 0.2, // Decay SLOWER
                                sync: false,
                                startValue: "max" as const,
                                destroy: "min" as const,
                            },
                        },
                        size: {
                            value: { min: 1, max: 3 },
                            animation: {
                                enable: false,
                            }
                        },
                        life: {
                            count: 1,
                            duration: {
                                value: { min: 2, max: 4 },
                            },
                        },
                        move: {
                            enable: true,
                            gravity: {
                                enable: true,
                                acceleration: 9.81,
                                inverse: false, // Fall down
                            },
                            speed: { min: 5, max: 15 },
                            direction: "none" as const,
                            random: true,
                            outModes: "destroy" as const,
                            decay: 0.05,
                            trail: {
                                enable: true,
                                length: 40, // VERY LONG trails for explosion
                                fillColor: "transparent",
                            }
                        },
                    },
                },
            },
        },
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
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    // removed background: transparent here, handled by options
                }}
            />
        </div>
    );
};
