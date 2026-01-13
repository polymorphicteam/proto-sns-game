// src/components/vfx/victoryEffects.ts
import * as BABYLON from "@babylonjs/core";
import { createWavingFlag, WavingFlag } from "./wavingFlag";

/**
 * Creates a spectacular fireworks, confetti, and waving flag effect for victory celebration
 */
export function createVictoryEffects(scene: BABYLON.Scene) {
    const emitters: BABYLON.ParticleSystem[] = [];
    let isActive = false;
    let wavingFlag: WavingFlag | null = null;

    // Confetti colors - bright and festive
    const confettiColors = [
        new BABYLON.Color4(1, 0.2, 0.2, 1),   // Red
        new BABYLON.Color4(0.2, 1, 0.2, 1),   // Green
        new BABYLON.Color4(0.2, 0.2, 1, 1),   // Blue
        new BABYLON.Color4(1, 1, 0.2, 1),     // Yellow
        new BABYLON.Color4(1, 0.5, 0, 1),     // Orange
        new BABYLON.Color4(1, 0.2, 1, 1),     // Magenta
        new BABYLON.Color4(0, 1, 1, 1),       // Cyan
        new BABYLON.Color4(1, 0.8, 0, 1),     // Gold
    ];

    /**
     * Create a single firework burst at a position
     */
    function createFireworkBurst(position: BABYLON.Vector3, color: BABYLON.Color4) {
        const firework = new BABYLON.ParticleSystem("firework", 300, scene);

        // Use a simple generated texture (no external URL)
        const textureSize = 32;
        const textureData = new Uint8Array(textureSize * textureSize * 4);
        for (let y = 0; y < textureSize; y++) {
            for (let x = 0; x < textureSize; x++) {
                const idx = (y * textureSize + x) * 4;
                const cx = x - textureSize / 2;
                const cy = y - textureSize / 2;
                const dist = Math.sqrt(cx * cx + cy * cy);
                const fade = Math.max(0, 1 - dist / (textureSize / 2));
                textureData[idx] = 255;
                textureData[idx + 1] = 255;
                textureData[idx + 2] = 255;
                textureData[idx + 3] = Math.floor(fade * 255);
            }
        }
        const texture = BABYLON.RawTexture.CreateRGBATexture(
            textureData, textureSize, textureSize, scene, false, false
        );
        firework.particleTexture = texture;

        firework.emitter = position;

        // Explosion pattern - burst outward in all directions
        firework.createSphereEmitter(1);

        // Colors
        firework.color1 = color;
        firework.color2 = new BABYLON.Color4(
            Math.min(1, color.r + 0.3),
            Math.min(1, color.g + 0.3),
            Math.min(1, color.b + 0.3),
            1
        );
        firework.colorDead = new BABYLON.Color4(
            color.r * 0.5,
            color.g * 0.5,
            color.b * 0.5,
            0
        );

        // Size
        firework.minSize = 1;
        firework.maxSize = 3;

        // Lifetime
        firework.minLifeTime = 0.8;
        firework.maxLifeTime = 2;

        // Speed - explode outward
        firework.minEmitPower = 30;
        firework.maxEmitPower = 60;

        // Gravity - particles fall
        firework.gravity = new BABYLON.Vector3(0, -40, 0);

        // Emit all at once
        firework.emitRate = 500;
        firework.manualEmitCount = 150;

        // Blend mode for glow
        firework.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Single burst
        firework.targetStopDuration = 0.05;
        firework.disposeOnStop = true;

        firework.start();
        console.log(`🎆 Firework burst at (${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)})`);
        return firework;
    }

    /**
     * Create confetti shower effect
     */
    function createConfettiShower() {
        const confetti = new BABYLON.ParticleSystem("confetti", 800, scene);

        // Generate confetti texture (small colored squares)
        const textureSize = 16;
        const textureData = new Uint8Array(textureSize * textureSize * 4);
        for (let i = 0; i < textureData.length; i += 4) {
            textureData[i] = 255;
            textureData[i + 1] = 255;
            textureData[i + 2] = 255;
            textureData[i + 3] = 255;
        }
        const texture = BABYLON.RawTexture.CreateRGBATexture(
            textureData, textureSize, textureSize, scene, false, false
        );
        confetti.particleTexture = texture;

        // Get camera position to emit from above
        const camera = scene.activeCamera;
        const cameraPos = camera ? camera.position : new BABYLON.Vector3(0, 50, 0);

        // Emit from above the camera view
        confetti.emitter = new BABYLON.Vector3(0, 80, -50);

        // Wide box emitter
        confetti.createBoxEmitter(
            new BABYLON.Vector3(-1, -1, -0.5),   // direction1
            new BABYLON.Vector3(1, -1, 0.5),    // direction2
            new BABYLON.Vector3(-80, 0, -30),   // minEmitBox
            new BABYLON.Vector3(80, 0, 30)      // maxEmitBox
        );

        // Random colors per particle update
        confetti.color1 = new BABYLON.Color4(1, 0.2, 0.2, 1);
        confetti.color2 = new BABYLON.Color4(0.2, 0.2, 1, 1);

        // Add color variation
        confetti.addColorGradient(0, new BABYLON.Color4(1, 0.3, 0.3, 1));
        confetti.addColorGradient(0.25, new BABYLON.Color4(0.3, 1, 0.3, 1));
        confetti.addColorGradient(0.5, new BABYLON.Color4(0.3, 0.3, 1, 1));
        confetti.addColorGradient(0.75, new BABYLON.Color4(1, 1, 0.3, 1));
        confetti.addColorGradient(1, new BABYLON.Color4(1, 0.3, 1, 1));

        // Size - confetti pieces
        confetti.minSize = 1;
        confetti.maxSize = 2.5;

        // Lifetime
        confetti.minLifeTime = 4;
        confetti.maxLifeTime = 8;

        // Speed
        confetti.minEmitPower = 10;
        confetti.maxEmitPower = 25;

        // Gravity
        confetti.gravity = new BABYLON.Vector3(0, -15, 0);

        // Rotation - tumbling confetti
        confetti.minAngularSpeed = -3;
        confetti.maxAngularSpeed = 3;

        // Emit rate
        confetti.emitRate = 150;

        // Billboard mode
        confetti.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;

        confetti.disposeOnStop = false;

        emitters.push(confetti);
        console.log("🎊 Confetti shower started");
        return confetti;
    }

    /**
     * Start the victory celebration!
     */
    function startVictory() {
        if (isActive) return;
        isActive = true;

        console.log("🎆🎊🇺🇸 Starting victory celebration with American flag!");

        // Create waving American flag - centered in view
        wavingFlag = createWavingFlag(scene, new BABYLON.Vector3(0, 35, -80), {
            width: 50,
            height: 30,
            segments: 40
        });

        // Start confetti shower
        const confetti = createConfettiShower();
        confetti.start();

        // Launch fireworks at intervals
        let fireworkCount = 0;
        const maxFireworks = 20;

        const launchFirework = () => {
            if (fireworkCount >= maxFireworks || !isActive) return;

            // Position in front of camera, spread across screen
            const x = (Math.random() - 0.5) * 120;
            const y = 20 + Math.random() * 60;
            const z = -60 - Math.random() * 60;
            const position = new BABYLON.Vector3(x, y, z);

            // Random color
            const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];

            createFireworkBurst(position, color);
            fireworkCount++;

            // Schedule next firework (rapid bursts)
            const delay = 150 + Math.random() * 300;
            setTimeout(launchFirework, delay);
        };

        // Start launching fireworks immediately
        launchFirework();

        // Stop confetti after duration
        setTimeout(() => {
            if (confetti) {
                confetti.stop();
                setTimeout(() => {
                    confetti.dispose();
                    const index = emitters.indexOf(confetti);
                    if (index > -1) emitters.splice(index, 1);
                }, 8000); // Wait for particles to fall
            }
        }, 6000);
    }

    /**
     * Stop all effects
     */
    function stopVictory() {
        isActive = false;

        if (wavingFlag) {
            wavingFlag.dispose();
            wavingFlag = null;
        }

        for (const emitter of emitters) {
            emitter.stop();
            setTimeout(() => emitter.dispose(), 3000);
        }
        emitters.length = 0;
        console.log("🎆 Victory celebration ended");
    }

    /**
     * Dispose all resources
     */
    function dispose() {
        isActive = false;

        if (wavingFlag) {
            wavingFlag.dispose();
            wavingFlag = null;
        }

        for (const emitter of emitters) {
            emitter.dispose();
        }
        emitters.length = 0;
    }

    return {
        startVictory,
        stopVictory,
        dispose,
        get isActive() { return isActive; }
    };
}

export type VictoryEffects = ReturnType<typeof createVictoryEffects>;
