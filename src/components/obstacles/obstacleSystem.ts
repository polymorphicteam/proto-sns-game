// src/components/obstacles/obstacleSystem.ts
import * as BABYLON from "@babylonjs/core";
import { scanObstacleFolders } from "./obstacleModelScanner";
import { ObstacleGLBBuilder } from "./obstacleGLBBuilder";

import { ALL_PATTERNS, ObstaclePattern } from "./obstaclePatterns";

export type ObstacleType = "jump" | "duck" | "platform" | "insuperable";

export interface ObstacleSystemOptions {
  laneWidth?: number;
  laneCount?: number;
  spawnZ?: number;
  despawnZ?: number;
  minSpawnDelay?: number;
  maxSpawnDelay?: number;
}

import { CoinController } from "../world/coinSystem";

export interface ObstacleController {
  getActiveObstacles(): ObstacleInstance[];
  getActivePlatformMeshes(): BABYLON.AbstractMesh[];
  dispose(): void;
  reset(): void;
}

export interface ObstacleInstance {
  mesh: BABYLON.AbstractMesh;
  collisionMeshes: BABYLON.AbstractMesh[];
  type: ObstacleType;
  variant?: number;
  active: boolean;
}

function createMaterial(
  scene: BABYLON.Scene,
  color: BABYLON.Color3,
  emissive: BABYLON.Color3
) {
  const mat = new BABYLON.PBRMaterial("obstaclePBR", scene);
  mat.albedoColor = color;
  mat.emissiveColor = emissive;
  mat.metallic = 0.0;
  mat.roughness = 0.9;
  return mat;
}

function buildJumpObstacle(
  scene: BABYLON.Scene,
  material: BABYLON.Material
): BABYLON.Mesh {
  const mesh = BABYLON.MeshBuilder.CreateBox(
    "obs_jump",
    { width: 12, height: 12, depth: 14 },
    scene
  );
  mesh.material = material;
  mesh.position.y = 6;
  return mesh;
}

function buildDuckObstacle(
  scene: BABYLON.Scene,
  material: BABYLON.Material
): BABYLON.Mesh {
  const frame = BABYLON.MeshBuilder.CreateBox(
    "obs_duck",
    { width: 18, height: 6, depth: 10 },
    scene
  );
  frame.material = material;
  frame.position.y = 12;
  return frame;
}

function buildPlatformObstacle(
  scene: BABYLON.Scene,
  material: BABYLON.Material
): BABYLON.Mesh {
  // CONFIGURAZIONE AGGIORNATA
  // Altezza: 10 (Alta, ma superabile col salto max di 13.6)
  // Profondità: 90 (Lunga piattaforma)
  const width = 18;
  const height = 15;
  const depth = 90;

  const platform = BABYLON.MeshBuilder.CreateBox(
    "obs_platform",
    { width, height, depth },
    scene
  );
  platform.material = material;

  // POSIZIONAMENTO
  // Alziamo il centro di metà dell'altezza affinché
  // la base tocchi esattamente y = 0
  platform.position.y = height / 2;

  return platform;
}

function buildInsuperableObstacle(
  scene: BABYLON.Scene,
  material: BABYLON.Material
): BABYLON.Mesh {
  // Tall wall that cannot be jumped over
  const mesh = BABYLON.MeshBuilder.CreateBox(
    "obs_insuperable",
    { width: 12, height: 25, depth: 10 },
    scene
  );
  mesh.material = material;
  mesh.position.y = 12.5; // Center at half height
  return mesh;
}

import { useGameStore } from "../../store/gameStore";

export function createObstacleSystem(
  scene: BABYLON.Scene,
  shadowGenerator: BABYLON.ShadowGenerator,
  getScrollSpeed: () => number,
  coinController: CoinController,
  options: ObstacleSystemOptions = {}
): ObstacleController {
  const laneWidth = options.laneWidth ?? 25;
  const laneCount = options.laneCount ?? 3;
  const spawnZ = options.spawnZ ?? -1500;
  const despawnZ = options.despawnZ ?? 200;
  const minSpawnDelay = options.minSpawnDelay ?? 1.2;
  const maxSpawnDelay = options.maxSpawnDelay ?? 2.6;

  const materials = {
    jump: createMaterial(
      scene,
      new BABYLON.Color3(0.8, 0.2, 0.2),
      new BABYLON.Color3(0.2, 0.05, 0.05)
    ),
    duck: createMaterial(
      scene,
      new BABYLON.Color3(0.2, 0.6, 0.9),
      new BABYLON.Color3(0.05, 0.15, 0.25)
    ),
    platform: createMaterial(
      scene,
      new BABYLON.Color3(0.35, 0.8, 0.4),
      new BABYLON.Color3(0.08, 0.2, 0.1)
    ),
    insuperable: createMaterial(
      scene,
      new BABYLON.Color3(0.5, 0.2, 0.8), // Purple
      new BABYLON.Color3(0.1, 0.05, 0.2)
    ),
  };

  // Initialize GLB system
  const modelMap = scanObstacleFolders();
  ObstacleGLBBuilder.preloadAll(scene, modelMap);

  const root = new BABYLON.TransformNode("obstacles_root", scene);

  const obstacleBuilders: Record<ObstacleType, () => BABYLON.Mesh> = {
    jump: () => buildJumpObstacle(scene, materials.jump),
    duck: () => buildDuckObstacle(scene, materials.duck),
    platform: () => buildPlatformObstacle(scene, materials.platform),
    insuperable: () => buildInsuperableObstacle(scene, materials.insuperable),
  };

  const obstaclePool: ObstacleInstance[] = [];
  const activeObstacles: ObstacleInstance[] = [];

  function acquire(type: ObstacleType) {
    const variantCount = ObstacleGLBBuilder.getVariantCount(type);
    const variantIndex =
      variantCount > 0 ? Math.floor(Math.random() * variantCount) : undefined;

    const pooled = obstaclePool.find((o) => {
      if (o.type !== type || o.active) return false;
      if (variantIndex === undefined) return true;
      // Allow variant-specific match, or fall back to a generic mesh (no variant)
      return o.variant === variantIndex || o.variant === undefined;
    });
    if (pooled) {
      pooled.active = true;
      pooled.mesh.setEnabled(true);
      return pooled;
    }

    // Try to get a GLB mesh first
    let mesh: BABYLON.AbstractMesh | null = null;
    let collisionMeshes: BABYLON.AbstractMesh[] | null = null;
    let variantUsed = variantIndex;

    const glbResult =
      variantIndex !== undefined
        ? ObstacleGLBBuilder.getMesh(type, scene, variantIndex)
        : ObstacleGLBBuilder.getMesh(type, scene);

    if (glbResult) {
      mesh = glbResult.root;
      collisionMeshes = glbResult.collisionMeshes;
    } else {
      // Fallback to default builder
      mesh = obstacleBuilders[type]();
      collisionMeshes = [mesh];
      variantUsed = undefined;
    }

    mesh.parent = root;
    mesh.receiveShadows = true;
    mesh.metadata = { obstacleType: type, variant: variantUsed };
    shadowGenerator.addShadowCaster(mesh, true);

    const created: ObstacleInstance = {
      mesh,
      collisionMeshes: collisionMeshes ?? [mesh],
      type,
      variant: variantUsed,
      active: true
    };
    obstaclePool.push(created);
    return created;
  }

  let spawnTimer = 0;
  let currentPattern: ObstaclePattern = ALL_PATTERNS[0];
  let currentPatternIndex = 0;
  let nextSpawnDelay = 2.0; // Initial delay

  function spawnFromPattern() {
    // Check if we need to switch pattern
    if (currentPatternIndex >= currentPattern.length) {
      // Pick a random pattern
      const randomIndex = Math.floor(Math.random() * ALL_PATTERNS.length);
      currentPattern = ALL_PATTERNS[randomIndex];
      currentPatternIndex = 0;
      console.log("Switched to pattern index:", randomIndex);
    }

    const step = currentPattern[currentPatternIndex];

    for (const def of step.obstacles) {
      const obs = acquire(def.type);
      const xPos = def.laneIndex * laneWidth;
      obs.mesh.position.set(xPos, obs.mesh.position.y, spawnZ);
      activeObstacles.push(obs);
    }

    // Spawn Coins
    if (step.coins) {
      for (const coinDef of step.coins) {
        coinController.spawnCoin(
          coinDef.laneIndex,
          coinDef.yOffset || 0,
          coinDef.count,
          coinDef.spacing
        );
      }
    }

    // Setup next spawn
    nextSpawnDelay = step.delayNext;
    currentPatternIndex++;
  }

  const observer = scene.onBeforeRenderObservable.add(() => {
    // FREEZE OBSTACLES IF NOT PLAYING, UNLESS BOUNCE BACK
    const state = useGameStore.getState().gameState;
    const speed = getScrollSpeed();
    const isBounceBack = state === "gameover" && speed < 0;

    if (state !== "playing" && !isBounceBack) return;

    const dt = scene.getEngine().getDeltaTime() / 1000;

    // Allow negative speed for bounce-back effect
    if (speed === 0) return;

    const movement = speed * dt;

    for (const obs of activeObstacles) {
      obs.mesh.position.z += movement;
    }

    for (let i = activeObstacles.length - 1; i >= 0; i--) {
      const obs = activeObstacles[i];
      if (obs.mesh.position.z > despawnZ) {
        obs.active = false;
        obs.mesh.setEnabled(false);
        activeObstacles.splice(i, 1);
      }
    }

    // Only spawn new obstacles when moving forward
    if (speed > 0) {
      spawnTimer += dt;
      if (spawnTimer >= nextSpawnDelay) {
        spawnTimer = 0;
        spawnFromPattern();
      }
    }
  });

  function dispose() {
    if (observer) {
      scene.onBeforeRenderObservable.remove(observer);
    }
    obstaclePool.forEach((o) => o.mesh.dispose());
    root.dispose();
  }

  function getActiveObstacles() {
    return activeObstacles;
  }

  function getActivePlatformMeshes() {
    return activeObstacles
      .filter((o) => o.type === "platform")
      .map((o) => o.mesh);
  }

  function reset() {
    // Deactivate all active obstacles
    for (const obs of activeObstacles) {
      obs.active = false;
      obs.mesh.setEnabled(false);
    }
    activeObstacles.length = 0;

    // Reset spawn state
    spawnTimer = 0;
    currentPatternIndex = 0;
    nextSpawnDelay = 2.0;

    // Reset to first pattern or random? Let's pick random to be fresh
    const randomIndex = Math.floor(Math.random() * ALL_PATTERNS.length);
    currentPattern = ALL_PATTERNS[randomIndex];

    console.log("Obstacle system reset");
  }

  return { dispose, getActiveObstacles, getActivePlatformMeshes, reset };
}
