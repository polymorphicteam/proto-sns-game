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

  // --- CONSTANTS (ACTION-WINDOW) ---
  const JUMP_COST = 1.3;
  const DUCK_COST = 1.0;
  const PLAT_COST = 1.8;
  const LANE_COST = 0.4;

  let spawnTimer = 1.0;
  let currentPattern: ObstaclePattern = ALL_PATTERNS[0];
  let currentPatternIndex = 0;
  let nextSpawnDelay = 1.0;

  // STATE TRACKING FOR ACTION WINDOW
  let lastActionCost = 0;
  let lastSafeLane = 0; // Start assuming center is safe

  function spawnFromPattern() {
    // Check if we need to switch pattern
    if (currentPatternIndex >= currentPattern.length) {
      const randomIndex = Math.floor(Math.random() * ALL_PATTERNS.length);
      currentPattern = ALL_PATTERNS[randomIndex];
      currentPatternIndex = 0;
      console.log("Switched to pattern index:", randomIndex);
    }

    const speed = getScrollSpeed();
    const step = currentPattern[currentPatternIndex];
    let maxDepthInStep = 0;

    // Track safe lane for this step (heuristic: find the lane WITHOUT a wall/obstacle)
    // If multiple lanes are safe, we pick the one closest to the previous safe lane to minimize assumed movement.
    // If NO lanes are safe (impossible?), we keep the previous one.
    // We also need to analyze the step to determine the MAX action cost required.
    let currentStepActionCost = 0;
    let openLanes = [false, false, false]; // indices 0, 1, 2 correpsonding to lanes -1, 0, 1

    // Initialize openLanes as true, then mark false if blocked
    openLanes = [true, true, true]; // -1, 0, 1

    for (const def of step.obstacles) {
      const obs = acquire(def.type);
      const xPos = def.laneIndex * laneWidth;

      // Mark lane as blocked
      const laneArrIdx = def.laneIndex + 1; // -1->0, 0->1, 1->2
      if (laneArrIdx >= 0 && laneArrIdx <= 2) {
        openLanes[laneArrIdx] = false;
      }

      // Determine Action Cost for this specific obstacle
      // If this obstacle is in the CURRENT safe path, it dictates the cost.
      // Since we don't know the player's position, we assume they take the path of least resistance 
      // OR we just take the max cost of the obstacles present if they force an action.
      // But typically, a pattern step has either walls + 1 action, OR just walls.
      // We'll take the MAX cost of any interactive obstacle in the step.
      let cost = 0;
      if (def.type === "jump") cost = JUMP_COST;
      else if (def.type === "duck") cost = DUCK_COST;
      else if (def.type === "platform") cost = PLAT_COST;

      if (cost > currentStepActionCost) {
        currentStepActionCost = cost;
      }

      // Check if this is a CAR under PLATFORM type
      const source = obs.mesh.metadata?.sourceUrl || "";
      const isCar = source.toLowerCase().includes("car");
      const isPlatformCar = isCar && obs.type === "platform";

      const yOffset = isPlatformCar ? -3 : 0;
      obs.mesh.position.set(xPos, obs.mesh.position.y + yOffset, spawnZ);

      let depth = 12;
      if (def.type === "platform") depth = 90;
      else if (def.type === "duck") depth = 10;
      else if (def.type === "insuperable") depth = 14;

      if (depth > maxDepthInStep) maxDepthInStep = depth;

      if (isCar && (obs.type === "insuperable" || obs.type === "platform")) {
        const isRightSide = def.laneIndex >= 0;
        obs.mesh.rotation.y = isRightSide ? Math.PI : 0;
      } else {
        obs.mesh.rotation.y = 0;
      }

      activeObstacles.push(obs);
    }

    // Determine the "Safe Lane" for this step
    // We look for the open lane closest to lastSafeLane
    let bestLane = lastSafeLane;
    let minDist = 999;
    let foundOpen = false;

    // Check -1, 0, 1
    for (let l = -1; l <= 1; l++) {
      if (openLanes[l + 1]) {
        const dist = Math.abs(l - lastSafeLane);
        if (dist < minDist) {
          minDist = dist;
          bestLane = l;
          foundOpen = true;
        }
      }
    }

    // If the step is fully blocked (e.g. all jumps?), then the "safe" lane is where the action is intended.
    // In our patterns, usually obstacles are the challenge. If there's a Jump in lane 0 and Walls elsewhere, 
    // Lane 0 is the "Path" but it has a cost.
    // If foundOpen is false, it means all lanes have obstacles. 
    // We assume the player stays in their lane or moves to the 'least dangerous' one?
    // Actually, if all blocked, the player MUST interact. We can assume the intended lane is the one with the interaction (Jump/Duck/Plat)
    // rather than the Wall.
    if (!foundOpen) {
      // Find non-wall lane
      for (const def of step.obstacles) {
        if (def.type !== "insuperable") {
          bestLane = def.laneIndex;
          break;
        }
      }
    }

    const currentSafeLane = bestLane;
    const laneChangeDiff = Math.abs(currentSafeLane - lastSafeLane);
    const laneBuffer = laneChangeDiff * LANE_COST;

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

    // Setup next spawn delay
    const timeSinceStart = performance.now() / 1000;
    const speedMultiplier = Math.max(0.4, 1.0 - (timeSinceStart / 300));

    // 1. Pattern Base Delay scaled by difficulty
    const patternDelay = step.delayNext * speedMultiplier;

    // 2. Physical Safety (Mesh Depth)
    // Time to clear the mesh at current speed + buffer
    // Start with 0 if speed is 0 to avoid Infinity
    let meshSafetyDelay = 0;
    if (speed > 0) {
      meshSafetyDelay = (maxDepthInStep + 20) / speed;
    }

    // 3. Action Window (Human Reaction + Animation)
    // The cost of the *PREVIOUS* action dictates when we can start the *NEXT* one.
    // Wait, the prompt says: "Se un'azione richiede un salto... il sistema deve sommare... per determinare il delay minimo dello step SUCCESSIVO"
    // So we use the cost calculated for THIS step to delay the NEXT spawn.
    // Actually, `lastActionCost` is the cost of the step that *just finished spawning* (which is this one, relative to the *next* one).
    // The delay we set NOW is for the *next* spawn.
    // So we use `currentStepActionCost` combined with the lane change we just did?
    // No, logic is: Player performs action NOW. We must wait `Cost` time before showing next obstacle.
    // AND if the *next* obstacle requires a lane change... we can't know that yet.
    // The Prompt says: "NextDelay must not be lower than lastActionCost".
    // "lastActionCost" in the prompt context implies the cost of the action associated with the obstacle we just spawned.
    // So `currentStepActionCost` (calculated above) BECOMES `lastActionCost` for the purpose of setting `nextSpawnDelay`.

    // Correction: We calculate the cost of the CURRENTLY SPAWNING step.
    // This cost dictates how much time the player needs to deal with IT before the NEXT thing appears.
    // PLUS the time needed to switch lanes TO this position (handled by laneBuffer calculated above).

    // Wait, if I shift lanes TO this obstacle, that time is spent BEFORE interacting? or DURING?
    // Prompt: "Se un'azione richiede un salto e un cambio di corsia contemporaneo, il sistema deve sommare JUMP_COST + LANE_COST"
    // So: TotalActionCost = ActionDuration + LaneTravelTime.

    const totalActionWindow = currentStepActionCost + laneBuffer;

    // FORMULA
    let calculatedDelay = Math.max(
      patternDelay,       // Design intent (scaled)
      meshSafetyDelay,    // Physics limits
      totalActionWindow   // Human limits
    );

    // Hard Floor (0.8s) -> as requested in previous prompt "non deve mai scendere sotto 0.8s"
    if (calculatedDelay < 0.8) calculatedDelay = 0.8;

    // DEBUG: Warn if Safety/Action clauses are overriding the Pattern
    if (calculatedDelay > patternDelay + 0.1 && patternDelay > 0) {
      console.warn(`[SAFETY TRIGGER] Delay pushed from ${patternDelay.toFixed(2)}s to ${calculatedDelay.toFixed(2)}s. (ActionCost: ${currentStepActionCost}, LaneDiff: ${laneChangeDiff}, MeshSafety: ${meshSafetyDelay.toFixed(2)})`);
    }

    nextSpawnDelay = calculatedDelay;

    // Update state for next cycle
    lastActionCost = currentStepActionCost;
    lastSafeLane = currentSafeLane;

    currentPatternIndex++;
  }

  // OBSERVER
  const observer = scene.onBeforeRenderObservable.add(() => {
    const state = useGameStore.getState().gameState;
    const speed = getScrollSpeed();
    const isBounceBack = state === "gameover" && speed < 0;

    if (state !== "playing" && !isBounceBack) return;

    const dt = scene.getEngine().getDeltaTime() / 1000;
    if (speed === 0) return;

    const movement = speed * dt;

    for (const obs of activeObstacles) {
      obs.mesh.position.z += movement;

      if (obs.type === "insuperable") {
        const sourceUrl = obs.mesh.metadata?.sourceUrl || "";
        const isSoda = sourceUrl.toLowerCase().includes("soda");
        if (isSoda) {
          const rotationSpeed = dt * 1.5;
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
