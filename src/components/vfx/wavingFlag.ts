// src/components/vfx/wavingFlag.ts
import * as BABYLON from "@babylonjs/core";

/**
 * Creates a 3D American flag with a cyclic wave animation
 */
export function createWavingFlag(scene: BABYLON.Scene, position: BABYLON.Vector3, options: {
    width?: number;
    height?: number;
    segments?: number;
} = {}) {
    const width = options.width ?? 40;
    const height = options.height ?? 25;
    const segments = 128; // Massive increase for silky smooth waves

    // Create the flag mesh with many subdivisions for smooth waves
    const flag = BABYLON.MeshBuilder.CreateGround("americanFlag", {
        width: width,
        height: height,
        subdivisions: segments,
        updatable: true
    }, scene);

    // Position and Rotate
    // Fix: Rotate X by -90 for verticality. 
    // Rotate Y by 180 (Math.PI) to flip the mesh horizontally.
    // At rotation.y = Math.PI, Stars (U=0, Local -X) are on the LEFT.
    flag.rotation.x = -Math.PI / 2;
    flag.rotation.y = Math.PI;
    flag.position = position;

    // Store original vertex positions for animation
    const positions = flag.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions) return null;
    const originalPositions = new Float32Array(positions);

    // Create flag texture procedurally
    const textureWidth = 512;
    const textureHeight = 320;
    const flagTexture = createAmericanFlagTexture(scene, textureWidth, textureHeight);

    // Create material
    const flagMaterial = new BABYLON.StandardMaterial("flagMat", scene);
    flagMaterial.diffuseTexture = flagTexture;
    flagMaterial.emissiveTexture = flagTexture;
    flagMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Brighter
    flagMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    flagMaterial.backFaceCulling = false;
    flag.material = flagMaterial;

    // Wave animation parameters
    let time = 0;
    const waveAmplitude = 1.5; // Stronger (was 0.8)
    const waveFrequency = 0.45; // Slightly more waves for better definition
    const waveSpeed = 0.8; // Faster (was 0.4)

    // Animation observer
    const animationObserver = scene.onBeforeRenderObservable.add(() => {
        time += scene.getEngine().getDeltaTime() / 1000;

        if (!positions) return;
        const newPositions = new Float32Array(positions.length);

        for (let i = 0; i < positions.length; i += 3) {
            const x = originalPositions[i];
            const y = originalPositions[i + 1];
            const z = originalPositions[i + 2];

            // Calculate wave based on X position (distance from pole)
            // Local X ranges from -width/2 to width/2.
            // With rotation.y = Math.PI:
            // Stars (U=0, Local -X) are on the Viewer LEFT.
            // user: "fade on the left and grow towards the right"
            // So anchor (dist=0) should be at Viewer LEFT (Local -X).
            const dist = (x + width / 2) / width;

            // Smoother wave amount: fixed at pole (0), increases towards end (1)
            const waveAmount = Math.pow(dist, 1.5);

            // Smooth cyclic sine wave
            const phase = x * waveFrequency - time * waveSpeed;
            const wave = Math.sin(phase) * waveAmplitude * waveAmount;

            // Add a secondary cross-wave for more organic look
            const secondaryPhase = y * 0.2 + time * 0.3;
            const secondaryWave = Math.sin(secondaryPhase) * (waveAmplitude * 0.2) * waveAmount;

            newPositions[i] = x;
            newPositions[i + 1] = y;
            newPositions[i + 2] = z + wave + secondaryWave;
        }

        flag.updateVerticesData(BABYLON.VertexBuffer.PositionKind, newPositions);
    });

    // Dispose function
    function dispose() {
        scene.onBeforeRenderObservable.remove(animationObserver);
        flag.dispose();
        flagMaterial.dispose();
        flagTexture.dispose();
    }

    return {
        mesh: flag,
        dispose
    };
}

/**
 * Creates an American flag texture procedurally
 */
function createAmericanFlagTexture(scene: BABYLON.Scene, width: number, height: number): BABYLON.DynamicTexture {
    const texture = new BABYLON.DynamicTexture("americanFlag", { width, height }, scene, false);
    const ctx = texture.getContext();

    // Colors
    const red = "#B22234";
    const white = "#FFFFFF";
    const blue = "#3C3B6E";

    // Draw stripes
    const stripeHeight = height / 13;
    for (let i = 0; i < 13; i++) {
        ctx.fillStyle = i % 2 === 0 ? red : white;
        ctx.fillRect(0, i * stripeHeight, width, stripeHeight);
    }

    // Draw blue canton (top left)
    const cantonWidth = width * 0.4;
    const cantonHeight = stripeHeight * 7;
    ctx.fillStyle = blue;
    ctx.fillRect(0, 0, cantonWidth, cantonHeight);

    // Draw stars (simplified 5x4 + 4x5 grid = 50 stars approximation)
    ctx.fillStyle = white;
    const starRows = [6, 5, 6, 5, 6, 5, 6, 5, 6]; // 9 rows alternating
    let starY = stripeHeight * 0.5;
    const starSpacingY = (cantonHeight - stripeHeight) / 9;

    for (let row = 0; row < starRows.length; row++) {
        const starsInRow = starRows[row];
        const starSpacingX = cantonWidth / (starsInRow + 1);
        const offsetX = row % 2 === 0 ? 0 : starSpacingX / 2;

        for (let star = 0; star < starsInRow; star++) {
            const starX = offsetX + starSpacingX * (star + 1);
            drawStar(ctx as any, starX, starY, 4, 5);
        }
        starY += starSpacingY;
    }

    texture.update();
    return texture;
}

/**
 * Draw a 5-pointed star
 */
function drawStar(ctx: any, cx: number, cy: number, innerRadius: number, outerRadius: number) {
    const points = 5;
    const step = Math.PI / points;

    ctx.beginPath();
    for (let i = 0; i < 2 * points; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = i * step - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.fill();
}

export type WavingFlag = ReturnType<typeof createWavingFlag>;
