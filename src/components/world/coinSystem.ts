import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import { PlayerAABB } from "../player/playerController";

import { useGameStore } from "../../store/gameStore";

export interface CoinSystemOptions {
    spawnZ?: number;
    despawnZ?: number;
    laneWidth?: number;
    modelPath?: string;
}

export interface CoinInstance {
    mesh: BABYLON.AbstractMesh;
    active: boolean;
    rotationSpeed: number;
}

export interface CoinController {
    spawnCoin(laneIndex: number, yOffset: number, count?: number, spacing?: number): void;
    update(dt: number, scrollSpeed: number): void;
    checkCollisions(playerAABB: PlayerAABB): number;
    dispose(): void;
    reset(): void;
    isReady(): boolean;
}

export function createCoinSystem(
    scene: BABYLON.Scene,
    shadowGenerator: BABYLON.ShadowGenerator,
    getScrollSpeed: () => number,
    options: CoinSystemOptions = {}
): CoinController {
    const spawnZ = options.spawnZ ?? -520;
    const despawnZ = options.despawnZ ?? 200;
    const laneWidth = options.laneWidth ?? 25;
    const modelPath = options.modelPath ?? "/scene/assets/model/coin/Bitcoin.glb";

    const root = new BABYLON.TransformNode("coins_root", scene);
    const coinPool: CoinInstance[] = [];
    const activeCoins: CoinInstance[] = [];

    // Source container for instancing (loaded from GLB)
    let sourceContainer: BABYLON.AssetContainer | null = null;
    let isLoaded = false;
    const pendingSpawns: Array<{ laneIndex: number; yOffset: number; count: number; spacing: number }> = [];

    // Load the Bitcoin GLB model using AssetContainer
    BABYLON.SceneLoader.LoadAssetContainerAsync(modelPath, "", scene).then((container) => {
        console.log("🪙 Bitcoin GLB loaded successfully");
        console.log(`   Meshes: ${container.meshes.length}`);

        sourceContainer = container;
        isLoaded = true;

        // Process any pending spawns
        for (const pending of pendingSpawns) {
            spawnCoinInternal(pending.laneIndex, pending.yOffset, pending.count, pending.spacing);
        }
        pendingSpawns.length = 0;
    }).catch((error) => {
        console.error("❌ Failed to load Bitcoin GLB:", error);
        isLoaded = true; // Mark as loaded to prevent hangs
    });

    function createCoinMesh(): BABYLON.AbstractMesh | null {
        if (!sourceContainer) return null;

        // Instantiate the model - creates a clone of all meshes
        const instances = sourceContainer.instantiateModelsToScene(
            (name) => `coin_${coinPool.length}_${name}`,
            false // Don't clone materials (share them)
        );

        if (instances.rootNodes.length === 0) {
            console.error("❌ No root nodes in coin container");
            return null;
        }

        // Create a container transform node for this coin
        const coinRoot = new BABYLON.TransformNode(`coin_root_${coinPool.length}`, scene);
        coinRoot.parent = root;

        // Parent all instantiated nodes to our container
        for (const node of instances.rootNodes) {
            node.parent = coinRoot;
        }

        // Scale the coin appropriately
        coinRoot.scaling = new BABYLON.Vector3(1, 1, 1);

        // Add all child meshes as shadow casters and make them reflective
        const allMeshes = coinRoot.getChildMeshes(false);
        for (const mesh of allMeshes) {
            shadowGenerator.addShadowCaster(mesh, true);
            mesh.receiveShadows = true;

            // Make coin reflective by adjusting material
            if (mesh.material && mesh.material instanceof BABYLON.PBRMaterial) {
                const pbrMat = mesh.material as BABYLON.PBRMaterial;
                pbrMat.metallic = 0.9;      // Highly metallic
                pbrMat.roughness = 0.2;     // Low roughness for reflections
            }
        }

        console.log(`🪙 Created coin with ${allMeshes.length} meshes`);

        // Return the transform node (cast to AbstractMesh for interface compatibility)
        return coinRoot as unknown as BABYLON.AbstractMesh;
    }

    function acquire(): CoinInstance | null {
        const pooled = coinPool.find((c) => !c.active);
        if (pooled) {
            pooled.active = true;
            pooled.mesh.setEnabled(true);
            // Re-enable all child meshes
            const children = (pooled.mesh as BABYLON.TransformNode).getChildMeshes?.(false);
            if (children) {
                children.forEach(m => m.setEnabled(true));
            }
            return pooled;
        }

        const mesh = createCoinMesh();
        if (!mesh) return null;

        const instance: CoinInstance = {
            mesh,
            active: true,
            rotationSpeed: 3.0,
        };
        coinPool.push(instance);
        return instance;
    }

    function spawnCoinInternal(laneIndex: number, yOffset: number, count: number = 1, spacing: number = 10) {
        const xPos = laneIndex * laneWidth;
        const baseY = 5;

        for (let i = 0; i < count; i++) {
            const coin = acquire();
            if (!coin) continue;

            const zOffset = i * spacing;
            coin.mesh.position.set(xPos, baseY + yOffset, spawnZ + zOffset);
            activeCoins.push(coin);
        }
    }

    function spawnCoin(laneIndex: number, yOffset: number, count: number = 1, spacing: number = 10) {
        if (!isLoaded || !sourceContainer) {
            // Queue for later
            pendingSpawns.push({ laneIndex, yOffset, count, spacing });
            return;
        }
        spawnCoinInternal(laneIndex, yOffset, count, spacing);
    }

    function update(dt: number, scrollSpeed: number) {
        // Allow negative speed for bounce-back effect
        if (scrollSpeed === 0) return;

        const movement = scrollSpeed * dt;

        for (let i = activeCoins.length - 1; i >= 0; i--) {
            const coin = activeCoins[i];

            // Move
            coin.mesh.position.z += movement;

            // Rotate
            coin.mesh.rotation.y += coin.rotationSpeed * dt;

            // Despawn
            if (coin.mesh.position.z > despawnZ) {
                coin.active = false;
                coin.mesh.setEnabled(false);
                activeCoins.splice(i, 1);
            }
        }
    }

    function checkCollisions(playerAABB: PlayerAABB): number {
        let collectedCount = 0;
        const coinRadius = 2.5; // Approximate hit radius

        for (let i = activeCoins.length - 1; i >= 0; i--) {
            const coin = activeCoins[i];
            const pos = coin.mesh.position;

            // Simple AABB check against coin point + radius
            // We treat coin as a small box
            const coinMinX = pos.x - coinRadius;
            const coinMaxX = pos.x + coinRadius;
            const coinMinY = pos.y - coinRadius;
            const coinMaxY = pos.y + coinRadius;
            const coinMinZ = pos.z - coinRadius;
            const coinMaxZ = pos.z + coinRadius;

            const intersect = !(
                playerAABB.max.x < coinMinX ||
                playerAABB.min.x > coinMaxX ||
                playerAABB.max.y < coinMinY ||
                playerAABB.min.y > coinMaxY ||
                playerAABB.max.z < coinMinZ ||
                playerAABB.min.z > coinMaxZ
            );

            if (intersect) {
                // Collected!
                coin.active = false;
                coin.mesh.setEnabled(false);
                activeCoins.splice(i, 1);
                collectedCount++;
            }
        }

        return collectedCount;
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
        // FREEZE COINS IF NOT PLAYING, UNLESS BOUNCE BACK
        const state = useGameStore.getState().gameState;
        const speed = getScrollSpeed();
        const isBounceBack = state === "gameover" && speed < 0;

        if (state !== "playing" && !isBounceBack) return;

        const dt = scene.getEngine().getDeltaTime() / 1000;
        update(dt, speed);
    });

    function dispose() {
        if (observer) {
            scene.onBeforeRenderObservable.remove(observer);
        }
        coinPool.forEach((c) => c.mesh.dispose());
        root.dispose();
    }

    function reset() {
        // Deactivate all active coins
        for (const coin of activeCoins) {
            coin.active = false;
            coin.mesh.setEnabled(false);
        }
        activeCoins.length = 0;
        console.log("Coin system reset");
    }

    return { spawnCoin, update, checkCollisions, dispose, reset, isReady: () => isLoaded };
}
