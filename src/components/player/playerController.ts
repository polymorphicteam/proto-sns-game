// src/components/player/playerController.ts
import * as BABYLON from "babylonjs";

import { loadPlayerModel } from "./playerModel";
import {
  PlayerState,
  createPlayerStateMachine,
} from "./playerStateMachine";
import { ObstacleController, ObstacleInstance } from "../world/obstacleSystem";
import { CoinController } from "../world/coinSystem";
import { useGameStore } from "../../store/gameStore";
import { createImpactVFX } from "./impactVFX";
export type PlayerAABB = { min: BABYLON.Vector3; max: BABYLON.Vector3 };

export interface PlayerController {
  handleKeyDown(event: KeyboardEvent): void;
  handleKeyUp(event: KeyboardEvent): void;
  startGame(): void;
  ensureIdle(): void;
  dispose(): void;
  reset(): void;
}

// --------------------------------------------------
// DEBUG CONFIG
// --------------------------------------------------
const DEBUG = {
  showRay: true,
  showPlayerAABB: true,
  showPlatformAABB: true,
};

// --------------------------------------------------
// TUNING CONFIG (jump & slide AABB offsets)
// --------------------------------------------------
const TUNING = {
  jumpAABBOffset: 4,   // aumenta il bound durante salto
  slideAABBOffset: 2,  // abbassa ulteriormente il bound in scivolata
};

export function setupPlayerController(
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  modelRoot: string,
  shadowGenerator: BABYLON.ShadowGenerator,
  setScrollSpeed: (speed: number) => void,
  obstacleController: ObstacleController,
  coinController: CoinController,
  onReady?: () => void
): PlayerController {
  // ------------------------------------------
  // INPUT STATE
  // ------------------------------------------
  const keyState = {
    forward: false,
    slide: false,
    jump: false,
    leftPressed: false,
    rightPressed: false,
  };

  let debugOverrideState: PlayerState | null = null;

  const debugKeyMap = {
    Digit1: "Idle",
    Digit2: "Run",
    Digit3: "Slide",
    Digit4: "Jump",
    Digit5: "Run_Idle",
  } as const;

  // ------------------------------------------
  // LANE SYSTEM CONFIG
  // ------------------------------------------
  const laneWidth = 25;
  const maxLane = 1;
  let currentLane = 0;
  let targetX = 0;
  const lateralLerp = 0.12;

  // ------------------------------------------
  // GAME FLOW
  // ------------------------------------------
  let gameStarted = false;
  let requestedStart = false;

  // ------------------------------------------
  // PLAYER ROOT + STATE MACHINE
  // ------------------------------------------
  let playerRoot: BABYLON.TransformNode | null = null;
  let stateMachine: ReturnType<typeof createPlayerStateMachine> | null = null;
  let baseY = 0;
  let groundBaseY = 0;
  let isOnPlatform = false;

  const playerCollider = {
    halfWidth: 0,
    halfDepth: 0,
    standingHeight: 0,
    slideHeight: 0,
    centerOffsetY: 0,
    slideCenterOffsetY: 0,
    initialized: false,
  };

  // Invulnerability duration must cover Fall (3.1s) + Getup (9.5s) animations + safety margin
  const INVULNERABILITY_AFTER_HIT = 4.0;
  let invulnerabilityTimer = 0;

  // ------------------------------------------
  // BOUNCE-BACK EFFECT (on collision)
  // ------------------------------------------
  const BOUNCE_BACK_DURATION = 0.25; // seconds - quick, sharp bounce
  const BOUNCE_BACK_INTENSITY = 3.0; // multiplier for reverse speed
  let bounceBackActive = false;
  let bounceBackTimer = 0;

  // ------------------------------------------
  // KINEMATIC JUMP
  // ------------------------------------------
  const jumpMotion = {
    active: false,
    velocity: 0,
    gravity: -180,
    jumpStrength: 75,
  };

  function startJumpMotion() {
    if (!playerRoot) return;
    if (jumpMotion.active) return;
    jumpMotion.active = true;
    jumpMotion.velocity = jumpMotion.jumpStrength;
  }

  function updateJumpMotion(dt: number) {
    if (!playerRoot) return;

    if (!jumpMotion.active) {
      if (playerRoot.position.y !== baseY) playerRoot.position.y = baseY;
      return;
    }

    jumpMotion.velocity += jumpMotion.gravity * dt;
    playerRoot.position.y += jumpMotion.velocity * dt;

    if (playerRoot.position.y <= baseY) {
      playerRoot.position.y = baseY;
      jumpMotion.active = false;
      jumpMotion.velocity = 0;
      if (!debugOverrideState && stateMachine) {
        stateMachine.setPlayerState("Run", true);
      }
    }
  }

  // ------------------------------------------
  // AABB PLAYER
  // ------------------------------------------
  function computePlayerAABB(): PlayerAABB | null {
    if (!playerRoot || !playerCollider.initialized) return null;

    const isSliding = stateMachine?.currentState === "Slide";
    const height = isSliding
      ? playerCollider.slideHeight
      : playerCollider.standingHeight;

    let centerOffset = isSliding
      ? playerCollider.slideCenterOffsetY
      : playerCollider.centerOffsetY;

    // ------------------------------------------------
    // TUNING: aumento del bound in salto
    // ------------------------------------------------
    if (jumpMotion.active) {
      centerOffset += TUNING.jumpAABBOffset;
    }

    // ------------------------------------------------
    // TUNING: riduzione del bound in scivolata
    // ------------------------------------------------
    if (isSliding) {
      centerOffset -= TUNING.slideAABBOffset;
    }

    const center = new BABYLON.Vector3(
      playerRoot.position.x,
      playerRoot.position.y + centerOffset,
      playerRoot.position.z
    );

    const halfHeight = height * 0.5;

    const aabb = {
      min: new BABYLON.Vector3(
        center.x - playerCollider.halfWidth,
        center.y - halfHeight,
        center.z - playerCollider.halfDepth
      ),
      max: new BABYLON.Vector3(
        center.x + playerCollider.halfWidth,
        center.y + halfHeight,
        center.z + playerCollider.halfDepth
      ),
    };

    // DEBUG DRAW PLAYER AABB
    if (DEBUG.showPlayerAABB) {
      const w = aabb.max.x - aabb.min.x;
      const h = aabb.max.y - aabb.min.y;
      const d = aabb.max.z - aabb.min.z;
      const centerPos = aabb.min.add(aabb.max).scale(0.5);

      const box = BABYLON.MeshBuilder.CreateBox(
        "debug_playerAABB",
        { width: w, height: h, depth: d },
        scene
      );
      box.position = centerPos;
      box.isPickable = false;
      box.visibility = 0.2;

      const mat = new BABYLON.StandardMaterial("m", scene);
      mat.emissiveColor = BABYLON.Color3.Red();
      box.material = mat;

      setTimeout(() => box.dispose(), 50);
    }

    return aabb;
  }

  // ------------------------------------------
  // AABB INTERSECTION
  // ------------------------------------------
  function intersectsAABB(a: PlayerAABB, b: PlayerAABB) {
    return !(
      a.max.x < b.min.x ||
      a.min.x > b.max.x ||
      a.max.y < b.min.y ||
      a.min.y > b.max.y ||
      a.max.z < b.min.z ||
      a.min.z > b.max.z
    );
  }

  // ------------------------------------------
  // PLATFORM RAYCAST (landing)
  // ------------------------------------------
  function updatePlatformRaycast() {
    if (!playerRoot) return;
    console.log("updatePlatformRaycast CALLED");

    const platformMeshes = obstacleController.getActivePlatformMeshes();
    const hasPlatforms = platformMeshes.length > 0;

    const rayOriginOffset = 2;
    const rayLength = 40;

    const origin = playerRoot.position.add(
      new BABYLON.Vector3(0, rayOriginOffset, 0)
    );

    const ray = new BABYLON.Ray(
      origin,
      new BABYLON.Vector3(0, -1, 0),
      rayLength
    );

    // DEBUG RAY
    if (DEBUG.showRay) {
      const rayEnd = origin.add(new BABYLON.Vector3(0, -rayLength, 0));
      const line = BABYLON.MeshBuilder.CreateLines(
        "debugRay",
        { points: [origin, rayEnd] },
        scene
      );
      line.color = BABYLON.Color3.Yellow();
      setTimeout(() => line.dispose(), 50);
    }

    const hit = scene.pickWithRay(ray, (mesh) => {
      const metaType =
        (mesh.metadata as any)?.obstacleType ||
        (mesh.parent && (mesh.parent.metadata as any)?.obstacleType);
      return metaType === "platform";
    });

    if (hit?.hit && hit.pickedPoint && hit.pickedMesh) {
      const bi = hit.pickedMesh.getBoundingInfo();
      const bbMin = bi?.boundingBox.minimumWorld;
      const bbMax = bi?.boundingBox.maximumWorld;

      // DEBUG PLATFORM AABB
      if (DEBUG.showPlatformAABB && bi) {
        const min = bbMin;
        const max = bbMax;
        const w = max.x - min.x;
        const h = max.y - min.y;
        const d = max.z - min.z;

        const box = BABYLON.MeshBuilder.CreateBox(
          "debug_platformAABB",
          { width: w, height: h, depth: d },
          scene
        );
        box.position = min.add(max).scale(0.5);
        box.isPickable = false;
        box.visibility = 0.15;

        const mat2 = new BABYLON.StandardMaterial("m2", scene);
        mat2.emissiveColor = BABYLON.Color3.Blue();
        box.material = mat2;

        setTimeout(() => box.dispose(), 50);
      }

      console.log("RAY HIT PLATFORM", {
        pickedPoint: hit.pickedPoint.toString(),
        playerY: playerRoot.position.y,
      });

      const landMargin = 1.5;
      const withinX =
        bbMin && bbMax
          ? playerRoot.position.x >= bbMin.x - landMargin &&
          playerRoot.position.x <= bbMax.x + landMargin
          : true;

      const withinZ =
        bbMin && bbMax
          ? playerRoot.position.z >= bbMin.z - landMargin &&
          playerRoot.position.z <= bbMax.z + landMargin
          : true;

      if (withinX && withinZ) {
        const platformY = hit.pickedPoint.y;
        const newBase = Math.max(platformY, groundBaseY);

        const landingSnap = 1.5;
        const descending = jumpMotion.active && jumpMotion.velocity <= 0;
        const closeEnough = playerRoot.position.y - newBase <= landingSnap;

        if (!jumpMotion.active || (descending && closeEnough)) {
          baseY = newBase;
          playerRoot.position.y = Math.max(playerRoot.position.y, baseY);

          if (jumpMotion.active) {
            jumpMotion.active = false;
            jumpMotion.velocity = 0;
            if (!debugOverrideState && stateMachine) {
              stateMachine.setPlayerState("Run", true);
            }
          }

          isOnPlatform = true;
          return;
        }
      }
    }

    if (!hasPlatforms) {
      isOnPlatform = false;
      baseY = groundBaseY;
      return;
    }

    if (isOnPlatform) {
      baseY = groundBaseY;
      if (!jumpMotion.active || jumpMotion.velocity <= 0) {
        jumpMotion.active = true;
        jumpMotion.velocity = 0;
      }
      isOnPlatform = false;
    } else {
      baseY = groundBaseY;
    }
  }

  // ------------------------------------------
  // COLLISIONE OSTACOLI
  // ------------------------------------------
  function triggerBounceBack(hitObstacle?: ObstacleInstance) {
    bounceBackActive = true;
    bounceBackTimer = BOUNCE_BACK_DURATION;

    // Create impact VFX if we know which obstacle was hit
    if (hitObstacle && playerRoot) {
      // Calculate impact point (lower to ground level for dust effect)
      const impactPoint = playerRoot.position.clone();
      impactPoint.y += 3; // Lowered from 8 to spawn closer to ground

      createImpactVFX(scene, impactPoint, hitObstacle.mesh, {
        duration: 0.4,
        particleCount: 60,
      });
    }

    console.log("🔙 Bounce-back effect triggered!");
  }

  function triggerFallState(hitObstacle?: ObstacleInstance) {
    if (!stateMachine) return;
    const current = stateMachine.currentState;
    if (current === "Fall" || current === "Getup" || current === "Death") return;

    // Trigger bounce-back effect with VFX
    triggerBounceBack(hitObstacle);
    // Update game store - decrement lives
    const store = useGameStore.getState();
    store.decrementLives();

    // Fetch fresh state to check actual remaining lives
    const freshState = useGameStore.getState();

    // Check for game over
    if (freshState.lives <= 0) {
      console.log("💀 GAME OVER - No lives remaining");

      jumpMotion.active = false;
      jumpMotion.velocity = 0;
      invulnerabilityTimer = INVULNERABILITY_AFTER_HIT;
      stateMachine.setPlayerState("Death", true);
      return;
    }

    jumpMotion.active = false;
    jumpMotion.velocity = 0;
    invulnerabilityTimer = INVULNERABILITY_AFTER_HIT;
    stateMachine.setPlayerState("Fall", true);
  }

  function checkObstacleCollision(): ObstacleInstance | null {
    if (!playerRoot || !stateMachine) return null;
    if (invulnerabilityTimer > 0) return null;

    const playerBox = computePlayerAABB();
    if (!playerBox) return null;

    const obstacles = obstacleController.getActiveObstacles();
    const platformTopTolerance = 1.2;

    for (const obs of obstacles) {
      if (!obs.active) continue;

      const mesh = obs.mesh;
      mesh.computeWorldMatrix(true);

      const bi = mesh.getBoundingInfo();
      if (!bi) continue;

      const obsBox = {
        min: bi.boundingBox.minimumWorld,
        max: bi.boundingBox.maximumWorld,
      };

      if (obs.type === "platform") {
        const playerAbove =
          playerBox.min.y >= obsBox.max.y - platformTopTolerance;
        if (isOnPlatform || playerAbove) continue;
      }

      if (intersectsAABB(playerBox, obsBox)) {
        console.log("AABB COLLISION DETECTED with", obs.type);
        return obs; // Return the obstacle that was hit
      }
    }

    return null;
  }

  // ------------------------------------------
  // LOAD PLAYER MODEL
  // ------------------------------------------
  loadPlayerModel(
    scene,
    camera,
    modelRoot,
    shadowGenerator,
    (info) => {
      playerRoot = info.playerRoot;
      baseY = playerRoot.position.y;
      groundBaseY = baseY;

      const { min: worldMin, max: worldMax } =
        info.playerRoot.getHierarchyBoundingVectors();

      const localMin = worldMin.subtract(info.playerRoot.position);
      const localMax = worldMax.subtract(info.playerRoot.position);

      const width = localMax.x - localMin.x;
      const depth = localMax.z - localMin.z;
      const height = localMax.y - localMin.y;

      playerCollider.halfWidth = width * 0.5;
      playerCollider.halfDepth = depth * 0.5;
      playerCollider.standingHeight = height;
      playerCollider.slideHeight = height * 0.6;
      playerCollider.centerOffsetY = localMin.y + height * 0.5;
      playerCollider.slideCenterOffsetY =
        localMin.y + playerCollider.slideHeight * 0.5;

      playerCollider.initialized = true;

      stateMachine = createPlayerStateMachine({
        scene,
        playerRoot: info.playerRoot,
        playerSkeleton: info.playerSkeleton,
        animationGroup: info.playerAnimationGroup,
        setScrollSpeed,
      });

      ensureIdle();

      if (requestedStart) startGame();

      onReady?.();
    }
  );

  // ------------------------------------------
  // INPUT
  // ------------------------------------------
  function handleKeyDown(event: KeyboardEvent) {
    const debugState = debugKeyMap[event.code as keyof typeof debugKeyMap];
    if (debugState) {
      event.preventDefault();
      triggerDebugState(debugState);
      return;
    }

    if (event.code === "Digit0") {
      event.preventDefault();
      triggerDebugState(null);
      return;
    }

    // RESTART GAME
    if (event.code === "KeyR") {
      const store = useGameStore.getState();
      // Allow restart only if game over (lives <= 0)
      if (store.lives <= 0) {
        console.log("🔄 RESTARTING GAME...");

        // 1. Reset Store
        store.resetGame();

        // 2. Reset World Systems
        obstacleController.reset();
        coinController.reset();

        // 3. Reset Player
        reset();

        // 4. Start Game again immediately? Or wait for input?
        // Let's go to Idle and wait for start (or auto-start if preferred)
        // For now, let's just reset to Idle. User can press Space/Click to start if needed,
        // or we can auto-start. Let's auto-start for smooth loop.
        startGame();
        return;
      }
    }

    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        keyState.leftPressed = true;
        performLaneSwitch(1);
        break;

      case "ArrowRight":
      case "KeyD":
        keyState.rightPressed = true;
        performLaneSwitch(-1);
        break;

      case "ArrowDown":
      case "KeyS":
        keyState.slide = true;
        break;

      case "KeyW":
        keyState.jump = true;
        break;
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        keyState.leftPressed = false;
        break;

      case "ArrowRight":
      case "KeyD":
        keyState.rightPressed = false;
        break;

      case "ArrowDown":
      case "KeyS":
        keyState.slide = false;
        break;

      case "KeyW":
        keyState.jump = false;
        break;
    }
  }

  // ------------------------------------------
  // DEBUG OVERRIDE
  // ------------------------------------------
  function triggerDebugState(state: PlayerState | null) {
    keyState.forward = false;
    keyState.slide = false;
    keyState.jump = false;
    keyState.leftPressed = false;
    keyState.rightPressed = false;

    debugOverrideState = state;

    if (state && stateMachine) {
      stateMachine.setPlayerState(state, true);
    } else if (stateMachine) {
      stateMachine.setPlayerState("Idle", true);
    }
  }

  // ------------------------------------------
  // LANE SWITCH
  // ------------------------------------------
  function performLaneSwitch(dir: number) {
    if (!playerRoot || !stateMachine) return;

    const previousLane = currentLane;
    currentLane = Math.min(maxLane, Math.max(-maxLane, currentLane + dir));

    if (previousLane === currentLane) return;

    targetX = currentLane * laneWidth;

    if (dir > 0) stateMachine.setPlayerState("Strafe_R");
    else stateMachine.setPlayerState("Strafe_L");
  }

  // ------------------------------------------
  // UPDATE MOVEMENT
  // ------------------------------------------
  function updateMovementState() {
    if (!playerRoot || !stateMachine) return;
    if (debugOverrideState) return;

    const curState = stateMachine.currentState;
    if (curState === "Fall" || curState === "Getup" || curState === "Death") return;

    if (keyState.jump && !jumpMotion.active) {
      // Force state transition to Jump even if currently in Slide state
      stateMachine.setPlayerState("Jump", true);
      startJumpMotion();
      keyState.jump = false;
      return;
    }

    if (keyState.slide) {
      stateMachine.setPlayerState("Slide");
      return;
    }

    if (!gameStarted) return;
  }

  // ------------------------------------------
  // MAIN UPDATE LOOP
  // ------------------------------------------
  scene.onBeforeRenderObservable.add(() => {
    if (!playerRoot || !stateMachine) return;

    updateMovementState();

    const dt = scene.getEngine().getDeltaTime() / 1000;
    invulnerabilityTimer = Math.max(0, invulnerabilityTimer - dt);

    // ------------------------------------------
    // BOUNCE-BACK EFFECT UPDATE
    // ------------------------------------------
    if (bounceBackActive) {
      bounceBackTimer -= dt;

      if (bounceBackTimer <= 0) {
        // Bounce finished, deactivate
        bounceBackActive = false;
        bounceBackTimer = 0;
        // Ensure scroll speed returns to 0 (Fall/Getup state)
        setScrollSpeed(0);
        console.log("✅ Bounce-back effect completed");
      } else {
        // Apply reverse scroll speed
        const normalSpeed = 80; // Base running speed
        const reverseSpeed = -normalSpeed * BOUNCE_BACK_INTENSITY;
        setScrollSpeed(reverseSpeed);
      }
    }

    playerRoot.position.x = BABYLON.Scalar.Lerp(
      playerRoot.position.x,
      targetX,
      lateralLerp
    );

    updatePlatformRaycast();
    updateJumpMotion(dt);

    if (!debugOverrideState) {
      if (
        stateMachine.currentState !== "Fall" &&
        stateMachine.currentState !== "Getup" &&
        stateMachine.currentState !== "Death"
      ) {
        const hitObstacle = checkObstacleCollision();
        if (hitObstacle) triggerFallState(hitObstacle);

        // Check Coins
        const playerBox = computePlayerAABB();
        if (playerBox) {
          const coinsCollected = coinController.checkCollisions(playerBox);
          if (coinsCollected > 0) {
            // TODO: Update UI with score
            console.log("Collected coins:", coinsCollected);
            // Dispatch event or callback? For now just log.
            const event = new CustomEvent("coinCollected", { detail: { count: coinsCollected } });
            window.dispatchEvent(event);
          }
        }
      }
    }

    const cur = stateMachine.currentState;
    const atTarget = Math.abs(playerRoot.position.x - targetX) < 0.5;

    if (
      gameStarted &&
      atTarget &&
      (cur === "Strafe_L" || cur === "Strafe_R")
    ) {
      stateMachine.setPlayerState("Run");
    }
  });

  function startGame() {
    requestedStart = true;
    gameStarted = true;

    // Update game state in store
    useGameStore.getState().setGameState('playing');

    if (stateMachine) stateMachine.setPlayerState("Run", true);
  }

  function ensureIdle() {
    if (stateMachine) stateMachine.ensureIdle();
  }

  function dispose() { }

  function reset() {
    if (!playerRoot || !stateMachine) return;

    // Reset position
    playerRoot.position.y = groundBaseY;
    baseY = groundBaseY;
    currentLane = 0;
    targetX = 0;
    playerRoot.position.x = 0;

    // Reset state
    gameStarted = false;
    requestedStart = false;
    isOnPlatform = false;
    jumpMotion.active = false;
    jumpMotion.velocity = 0;
    bounceBackActive = false;
    bounceBackTimer = 0;
    invulnerabilityTimer = 0;

    stateMachine.setPlayerState("Idle", true);
    setScrollSpeed(0);

    console.log("Player controller reset");
  }

  return {
    handleKeyDown,
    handleKeyUp,
    startGame,
    ensureIdle,
    dispose,
    reset,
  };
}
