// src/components/vfx/victoryText3D.ts
import * as BABYLON from "@babylonjs/core";
import earcut from "earcut";

/**
 * Creates a golden 3D beveled "VICTORY!" text that floats in the scene
 */
export function createVictoryText3D(scene: BABYLON.Scene) {
    let textMesh: BABYLON.Mesh | null = null;
    let animationObserver: BABYLON.Observer<BABYLON.Scene> | null = null;
    let isVisible = false;
    let animationTime = 0;
    let entranceProgress = 0;

    // Golden PBR material for luxurious metallic look
    const goldMaterial = new BABYLON.PBRMaterial("goldTextMaterial", scene);
    goldMaterial.albedoColor = new BABYLON.Color3(1.0, 0.84, 0.0);  // Gold color
    goldMaterial.metallic = 1.0;
    goldMaterial.roughness = 0.2;
    goldMaterial.reflectivityColor = new BABYLON.Color3(1, 0.9, 0.5);
    goldMaterial.ambientColor = new BABYLON.Color3(0.3, 0.25, 0.1);

    // Add slight emissive for glow effect
    goldMaterial.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0.0);

    /**
     * Create the 3D extruded text mesh
     */
    async function createTextMesh(): Promise<BABYLON.Mesh> {
        // Load font for text creation
        const fontData = await (await fetch("https://assets.babylonjs.com/fonts/Droid Sans_Regular.json")).json();

        // Create extruded text with bevel-like depth
        const text = BABYLON.MeshBuilder.CreateText(
            "victoryText",
            "VICTORY!",
            fontData,
            {
                size: 12,
                resolution: 32,
                depth: 4,          // Extrusion depth for beveled look
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            },
            scene,
            earcut
        );

        if (!text) {
            throw new Error("Failed to create victory text mesh");
        }

        // Apply gold material
        text.material = goldMaterial;

        // Get bounds for centering
        text.refreshBoundingInfo();
        const bounds = text.getBoundingInfo();
        const center = bounds.boundingBox.centerWorld;
        const size = bounds.boundingBox.extendSizeWorld;

        // Create a parent transform node for proper centering and rotation
        const pivot = new BABYLON.TransformNode("victoryTextPivot", scene);
        text.parent = pivot;

        // Offset the text so its center is at the pivot origin
        text.position.x = -center.x;
        text.position.y = -center.y;
        text.position.z = -center.z;

        // Rotate 180 degrees to face camera (text was created facing +Z, camera looks at -Z)
        pivot.rotation.y = Math.PI;

        // Position pivot in front of camera
        pivot.position.y = 45;
        pivot.position.z = -65;

        // Start invisible for entrance animation
        pivot.scaling.setAll(0);
        pivot.setEnabled(false);

        // Enable shadow receiving
        text.receiveShadows = true;

        console.log("🏆 Victory 3D text mesh created");
        // Return the pivot as the controllable mesh
        return pivot as unknown as BABYLON.Mesh;
    }

    /**
     * Easing function for smooth animation
     */
    function easeOutElastic(x: number): number {
        const c4 = (2 * Math.PI) / 3;
        return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }

    function easeOutBack(x: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }

    /**
     * Show the victory text with entrance animation
     */
    async function show() {
        if (isVisible) return;
        isVisible = true;
        animationTime = 0;
        entranceProgress = 0;

        // Create mesh if not exists
        if (!textMesh) {
            try {
                textMesh = await createTextMesh();
            } catch (error) {
                console.error("Failed to create victory text:", error);
                return;
            }
        }

        textMesh.setEnabled(true);

        // Start animation loop
        animationObserver = scene.onBeforeRenderObservable.add(() => {
            if (!textMesh || !isVisible) return;

            const dt = scene.getEngine().getDeltaTime() / 1000;
            animationTime += dt;

            // Entrance animation (first 1.2 seconds)
            if (entranceProgress < 1) {
                entranceProgress = Math.min(1, animationTime / 1.2);
                const scale = easeOutBack(entranceProgress);
                textMesh.scaling.setAll(scale);
            }

            // Floating animation after entrance
            if (entranceProgress >= 1) {
                const floatOffset = Math.sin(animationTime * 1.5) * 1.5;
                const baseY = 45;
                textMesh.position.y = baseY + floatOffset;

                // Subtle rotation oscillation (on top of the 180-degree base rotation)
                textMesh.rotation.y = Math.PI + Math.sin(animationTime * 0.8) * 0.08;
            }
        });

        console.log("🏆 Victory 3D text showing with animation");
    }

    /**
     * Hide the victory text
     */
    function hide() {
        if (!isVisible) return;
        isVisible = false;

        if (textMesh) {
            textMesh.setEnabled(false);
            textMesh.scaling.setAll(0);
        }

        if (animationObserver) {
            scene.onBeforeRenderObservable.remove(animationObserver);
            animationObserver = null;
        }

        console.log("🏆 Victory 3D text hidden");
    }

    /**
     * Dispose all resources
     */
    function dispose() {
        hide();

        if (textMesh) {
            textMesh.dispose();
            textMesh = null;
        }

        goldMaterial.dispose();
        console.log("🏆 Victory 3D text disposed");
    }

    return {
        show,
        hide,
        dispose,
        get isVisible() { return isVisible; }
    };
}

export type VictoryText3D = ReturnType<typeof createVictoryText3D>;
