import * as BABYLON from "@babylonjs/core";
import { PlayerAABB } from "../player/playerController";

import { useGameStore } from "../../store/gameStore";

export interface CoinSystemOptions {
    spawnZ?: number;
    despawnZ?: number;
    laneWidth?: number;
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

    // Material
    const coinMaterial = new BABYLON.StandardMaterial("coinMat", scene);
    coinMaterial.diffuseColor = new BABYLON.Color3(1, 0.8, 0); // Gold
    coinMaterial.emissiveColor = new BABYLON.Color3(0.4, 0.3, 0);
    coinMaterial.specularColor = new BABYLON.Color3(1, 1, 1);

    const root = new BABYLON.TransformNode("coins_root", scene);
    const coinPool: CoinInstance[] = [];
    const activeCoins: CoinInstance[] = [];

    function createCoinMesh(): BABYLON.AbstractMesh {
        // Create a cylinder acting as a coin
        const mesh = BABYLON.MeshBuilder.CreateCylinder(
            "coin",
            { diameter: 4, height: 0.5, tessellation: 16 },
            scene
        );
        mesh.rotation.x = Math.PI / 2; // Stand up facing camera
        mesh.material = coinMaterial;
        mesh.parent = root;
        mesh.checkCollisions = false; // We handle AABB manually

        // Glow effect? Maybe later.
        shadowGenerator.addShadowCaster(mesh, true);
        return mesh;
    }

    function acquire() {
        const pooled = coinPool.find((c) => !c.active);
        if (pooled) {
            pooled.active = true;
            pooled.mesh.setEnabled(true);
            return pooled;
        }

        const mesh = createCoinMesh();
        const instance: CoinInstance = {
            mesh,
            active: true,
            rotationSpeed: 3.0,
        };
        coinPool.push(instance);
        return instance;
    }

    function spawnCoin(laneIndex: number, yOffset: number, count: number = 1, spacing: number = 10) {
        const xPos = laneIndex * laneWidth;
        // Base Y for coin is usually around 4-5 units off ground, plus offset
        const baseY = 5;

        for (let i = 0; i < count; i++) {
            const coin = acquire();
            const zOffset = i * spacing;
            coin.mesh.position.set(xPos, baseY + yOffset, spawnZ + zOffset);
            activeCoins.push(coin);
        }
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

    return { spawnCoin, update, checkCollisions, dispose, reset };
}
