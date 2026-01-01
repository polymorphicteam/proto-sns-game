// src/components/obstacles/obstacleSystem.ts
import * as BABYLON from "@babylonjs/core";
import { scanObstacleFolders } from "./obstacleModelScanner";
import { ObstacleGLBBuilder } from "./obstacleGLBBuilder";
import { getObstacleMaterial } from "../materials/MaterialFactory";
import { buildHamburgerObstacle } from "./hamburgerBuilder";

import { ALL_PATTERNS, ObstaclePattern } from "./obstaclePatterns";

export type ObstacleType = "jump" | "duck" | "platform" | "insuperable" | "hamburger";

const HAMBURGER_AS_JUMP_PROBABILITY = 0;
const HAMBURGER_AS_INSUPERABLE_PROBABILITY = 0;

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
  isReady(): boolean;
  hasObstacleAt(x: number, z: number, radius: number): boolean;
}

export interface ObstacleInstance {
  mesh: BABYLON.AbstractMesh;
  collisionMeshes: BABYLON.AbstractMesh[];
  type: ObstacleType;
  variant?: number;
  /**
   * If true, this is a special hamburger instance masquerading as a "jump" obstacle.
   */
  isHamburgerVariant?: boolean;
  active: boolean;
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
  // Giant hamburger obstacle that cannot be jumped over!
  // Use scale 2.5 to make it tall enough to be impassable
  const hamburger = buildHamburgerObstacle(scene, 1.5);
  hamburger.name = "obs_insuperable";
  return hamburger;
}

import { useGameStore } from "../../store/gameStore";

export function createObstacleSystem(
  scene: BABYLON.Scene,
  shadowGenerator: BABYLON.ShadowGenerator,
  getScrollSpeed: () => number,
  coinController: CoinController,
  options: ObstacleSystemOptions = {},
  onReady?: () => void
): ObstacleController {
  const laneWidth = options.laneWidth ?? 25;
  const laneCount = options.laneCount ?? 3;
  // SPAWN SOONER (User Request)
  const spawnZ = options.spawnZ ?? -400; // Was -800, now -400 to appear even faster
  const despawnZ = options.despawnZ ?? 200;
  const minSpawnDelay = options.minSpawnDelay ?? 2.0;
  const maxSpawnDelay = options.maxSpawnDelay ?? 4.0;

  const materials = {
    jump: getObstacleMaterial(scene, "jump"),
    duck: getObstacleMaterial(scene, "duck"),
    platform: getObstacleMaterial(scene, "platform"),
    insuperable: getObstacleMaterial(scene, "insuperable"),
    hamburger: getObstacleMaterial(scene, "jump"), // Uses jump material as fallback
  };

  // Initialize GLB system
  const modelMap = scanObstacleFolders();
  let glbsReady = false;

  ObstacleGLBBuilder.preloadAll(scene, modelMap).then(() => {
    glbsReady = true;
    console.log("✅ Obstacle GLBs ready");
    if (onReady) onReady();
  });

  const root = new BABYLON.TransformNode("obstacles_root", scene);

  const obstacleBuilders: Record<ObstacleType, () => BABYLON.Mesh> = {
    jump: () => buildJumpObstacle(scene, materials.jump),
    duck: () => buildDuckObstacle(scene, materials.duck),
    platform: () => buildPlatformObstacle(scene, materials.platform),
    insuperable: () => buildInsuperableObstacle(scene, materials.insuperable),
    hamburger: () => buildHamburgerObstacle(scene, 1.0),
  };

  const obstaclePool: ObstacleInstance[] = [];
  const activeObstacles: ObstacleInstance[] = [];

  function acquire(type: ObstacleType) {
    // Determine if we should swap a "jump" or "insuperable" for a "hamburger"
    let useHamburger = false;

    // GUARD: If specifically requesting a hamburger, don't mess with probabilities
    if (type !== "hamburger") {
      if (type === "jump") {
        useHamburger = Math.random() < HAMBURGER_AS_JUMP_PROBABILITY;
      } else if (type === "insuperable") {
        useHamburger = Math.random() < HAMBURGER_AS_INSUPERABLE_PROBABILITY;
      }
    }

    const variantCount = ObstacleGLBBuilder.getVariantCount(type);
    const variantIndex =
      variantCount > 0 ? Math.floor(Math.random() * variantCount) : undefined;

    const pooled = obstaclePool.find((o) => {
      if (o.type !== type || o.active) return false;

      // Strict check match for hamburger variant
      // If useHamburger is true, we ONLY want isHamburgerVariant === true
      // If useHamburger is false, we ONLY want isHamburgerVariant === false (or undefined)
      const isHamburger = !!o.isHamburgerVariant;
      if (isHamburger !== useHamburger) return false;

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
    let variantUsed: number | undefined = variantIndex;

    // By default not a hamburger variant unless explicitly requested via probability swap
    let isHamburgerVariant = false;

    if (useHamburger) {
      // Bypass GLB loading entirely for hamburger swap
      // Use the procedural hamburger builder
      // Note: We keep type="jump" or "insuperable" for the system, but flag it as isHamburgerVariant

      const scale = type === "insuperable" ? 2.0 : 1.0;
      mesh = buildHamburgerObstacle(scene, scale);

      collisionMeshes = [mesh];
      variantUsed = undefined;
      isHamburgerVariant = true;
    } else {
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
      // Explicitly mark as NOT a hamburger variant (even if fallback looks like one)
      isHamburgerVariant = false;
    }

    mesh.parent = root;
    mesh.receiveShadows = true;
    mesh.metadata = { obstacleType: type, variant: variantUsed, isHamburgerVariant };
    shadowGenerator.addShadowCaster(mesh, true);

    const created: ObstacleInstance = {
      mesh,
      collisionMeshes: collisionMeshes ?? [mesh],
      type,
      variant: variantUsed,
      isHamburgerVariant,
      active: true
    };
    obstaclePool.push(created);
    return created;
  }

  let spawnTimer = 1.0; // Start at delay so first spawn is IMMEDIATE
  let currentPattern: ObstaclePattern = ALL_PATTERNS[0];
  let currentPatternIndex = 0;
  let nextSpawnDelay = 1.0; // Initial delay reduced from 2.0

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

      // Check if this is a CAR under PLATFORM type
      const source = obs.mesh.metadata?.sourceUrl || "";
      const isCar = source.toLowerCase().includes("car");
      const isPlatformCar = isCar && obs.type === "platform";

      // Lower ONLY platform cars by 3 units (User Request)
      const yOffset = isPlatformCar ? -3 : 0;
      obs.mesh.position.set(xPos, obs.mesh.position.y + yOffset, spawnZ);

      // Rotate CARS based on lane (Traffic Flow)
      // Left (-1) = With Traffic (Face +Z / Rot 0)
      // Right (1) = Oncoming (Face -Z / Rot PI)
      // Center (0) = Oncoming (Face -Z / Rot PI)
      if (isCar && (obs.type === "insuperable" || obs.type === "platform")) {
        const isRightSide = def.laneIndex >= 0;
        obs.mesh.rotation.y = isRightSide ? Math.PI : 0;
      } else {
        // Reset rotation for non-cars (e.g. reused mesh from pool)
        obs.mesh.rotation.y = 0;
      }

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
    // DIFFICULTY SCALING: Decrease delay over time
    // Delay decreases by 10% every 30 seconds
    const timeSinceStart = performance.now() / 1000;
    const speedMultiplier = Math.max(0.4, 1.0 - (timeSinceStart / 300)); // Cap at 40% (2.5x speed)

    nextSpawnDelay = step.delayNext * speedMultiplier;
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

      // Slowly rotate only Soda1.glb around LOCAL Y-axis
      if (obs.type === "insuperable") {
        // Check if this is a Soda mesh by checking the source URL in metadata
        const sourceUrl = obs.mesh.metadata?.sourceUrl || "";
        const isSoda = sourceUrl.toLowerCase().includes("soda");

        // Debug log (remove after testing)
        if (!obs.mesh.metadata?._debugLogged) {
          console.log(`[DEBUG] Insuperable mesh: ${obs.mesh.name}, sourceUrl: ${sourceUrl}, isSoda: ${isSoda}`);
          obs.mesh.metadata = obs.mesh.metadata || {};
          obs.mesh.metadata._debugLogged = true;
        }

        if (isSoda) {
          const rotationSpeed = dt * 1.5; // Rotation speed
          obs.mesh.rotate(BABYLON.Axis.Y, rotationSpeed, BABYLON.Space.LOCAL);
        }
      }
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

  function isReady() {
    return glbsReady;
  }

  // Check if there is an active obstacle at world position (x, z) within tolerance
  function hasObstacleAt(x: number, z: number, radius: number): boolean {
    // Only check active obstacles
    for (const obs of activeObstacles) {
      if (!obs.active) continue;

      const obsX = obs.mesh.position.x;
      const obsZ = obs.mesh.position.z;

      // Simple circular overlap check
      const dx = x - obsX;
      const dz = z - obsZ;
      const distSq = dx * dx + dz * dz;

      // Use squared distance for perf
      if (distSq < radius * radius) {
        return true;
      }
    }
    return false;
  }

  return { dispose, getActiveObstacles, getActivePlatformMeshes, reset, isReady, hasObstacleAt };
}
