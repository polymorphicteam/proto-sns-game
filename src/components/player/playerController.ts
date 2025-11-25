// src/components/player/playerController.ts
import * as BABYLON from "@babylonjs/core";

import { loadPlayerModel } from "./playerModel";
import {
  PlayerState,
  createPlayerStateMachine,
} from "./playerStateMachine";
import { ObstacleController, ObstacleInstance } from "../obstacles/obstacleSystem";
import { CoinController } from "../world/coinSystem";
import { useGameStore } from "../../store/gameStore";
import { createImpactVFX } from "./impactVFX";
export type PlayerAABB = { min: BABYLON.Vector3; max: BABYLON.Vector3 };

export interface PlayerController {
  handleKeyDown(event: KeyboardEvent): void;
  handleKeyUp(event: KeyboardEvent): void;
  handleTouchStart(event: TouchEvent): void;
  handleTouchMove(event: TouchEvent): void;
  handleTouchEnd(event: TouchEvent): void;
  handlePointerDown(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
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
  showPlayerAABB: false,
  showPlatformAABB: true,
};

// --------------------------------------------------
// TUNING CONFIG (jump & slide AABB offsets)
// --------------------------------------------------
const TUNING = {
  jumpAABBOffset: 4,   // aumenta il bound durante salto
  slideAABBOffset: 2,  // abbassa ulteriormente il bound in scivolata
};

let lastPlatformDebug = 0;

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

    // 🔥 Fix: disabilita raycast piattaforme durante caduta o rialzata
    if (stateMachine?.currentState === "Fall" || stateMachine?.currentState === "Getup") {
      return;
    }

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
      if ((mesh.metadata as any)?.isCollisionMesh === true) return true;
      if ((mesh.metadata as any)?.obstacleType === "platform") return true;
      if (mesh.parent && (mesh.parent.metadata as any)?.obstacleType === "platform")
        return true;
      return false;
    });

    if (hit?.hit && hit.pickedPoint && hit.pickedMesh) {
      const bi = hit.pickedMesh.getBoundingInfo();
      const bbMin = bi?.boundingBox.minimumWorld;
      const bbMax = bi?.boundingBox.maximumWorld;

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

      // Il player deve essere SOPRA la piattaforma, non davanti.
      // Controlliamo che la parte superiore della piattaforma (bbMax.y)
      // sia sotto al player ma non troppo sotto.
      const platformTopY = bbMax.y;
      const feetY = playerRoot.position.y;
      const deltaY = feetY - platformTopY;

      // true solo se la piattaforma è fisicamente sotto il giocatore
      // (tolleranza 0–10 unità, regolabile se serve)
      const platformBelow = deltaY >= -2 && deltaY <= 30;

      if (DEBUG.showPlatformAABB && hit) {
        const now = performance.now();
        if (now - lastPlatformDebug > 300) {
          lastPlatformDebug = now;

          console.log("----- PLATFORM LANDING DEBUG -----");
          console.log("Picked Mesh:", hit.pickedMesh?.name);
          console.log("isCollisionMesh:", (hit.pickedMesh?.metadata as any)?.isCollisionMesh);
          console.log("PickedPoint Y:", hit.pickedPoint?.y?.toFixed(3));
          console.log("Player Y:", playerRoot.position.y.toFixed(3));

          const bi = hit.pickedMesh?.getBoundingInfo();
          if (bi) {
            console.log("bbMinY:", bi.boundingBox.minimumWorld.y.toFixed(3));
            console.log("bbMaxY:", bi.boundingBox.maximumWorld.y.toFixed(3));
          }

          console.log("deltaY:", deltaY);
          console.log("feetY:", feetY);
          console.log("platformTopY:", platformTopY);
          console.log("withinX:", withinX);
          console.log("withinZ:", withinZ);
          console.log("platformBelow:", platformBelow);

          console.log("----------------------------------");
        }
      }

      if (withinX && withinZ && platformBelow) {
        const platformTopY = bbMax.y;
        const newBase = Math.max(platformTopY, groundBaseY);

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

      const collisionMeshes = obs.collisionMeshes?.length
        ? obs.collisionMeshes
        : [mesh];

      for (const collisionMesh of collisionMeshes) {
        collisionMesh.computeWorldMatrix(true);

        const bi = collisionMesh.getBoundingInfo();
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
          return obs; // Return the obstacle that was hit
        }
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

    // PAUSE TOGGLE (P)
    if (event.code === "KeyP") {
      const store = useGameStore.getState();
      if (store.gameState === "playing") {
        store.setGameState("paused");
        if (stateMachine) stateMachine.pauseAnimation();
      } else if (store.gameState === "paused") {
        store.setGameState("playing");
        if (stateMachine) stateMachine.resumeAnimation();
      }
      return;
    }

    // RESTART GAME (R)
    if (event.code === "KeyR") {
      restartGame();
      return;
    }

    // MOVEMENT INPUTS - Only if playing
    if (!isGameActive()) return;

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
      stateMachine.setPlayerState("Jump");
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
  const isGameActive = () => useGameStore.getState().gameState === "playing";

  scene.onBeforeRenderObservable.add(() => {
    if (!playerRoot || !stateMachine) return;

    // PAUSE CHECK: Freeze EVERYTHING
    if (useGameStore.getState().gameState === "paused") return;

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
        // COLLISION CHECKS - Only if game is active (not Game Over)
        if (isGameActive()) {
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

  function restartGame() {
    console.log("🔄 RESTARTING GAME...");

    // 1. Reset Store
    useGameStore.getState().resetGame();

    // 2. Reset World Systems
    obstacleController.reset();
    coinController.reset();

    // 3. Reset Player
    reset();

    // 4. Start Game
    startGame();
  }

  // ------------------------------------------
  // TOUCH & POINTER INPUT
  // ------------------------------------------
  const touchState = { startX: 0, startY: 0, startTime: 0, isDragging: false };
  const SWIPE_THRESHOLD = 50;
  const TAP_THRESHOLD = 200;
  const SWIPE_MAX_TIME = 500;

  function handleTouchStart(event: TouchEvent) {
    if (!isGameActive()) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchState.startX = touch.clientX; touchState.startY = touch.clientY;
    touchState.startTime = Date.now(); touchState.isDragging = true;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isGameActive() || !touchState.isDragging) return;
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!isGameActive() || !touchState.isDragging) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;
    const deltaTime = Date.now() - touchState.startTime;
    touchState.isDragging = false;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance < SWIPE_THRESHOLD && deltaTime < TAP_THRESHOLD) {
      keyState.jump = true; setTimeout(() => (keyState.jump = false), 100); return;
    }
    if (distance >= SWIPE_THRESHOLD && deltaTime < SWIPE_MAX_TIME) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) { performLaneSwitch(-1); } else { performLaneSwitch(1); }
      } else {
        if (deltaY < 0) { keyState.jump = true; setTimeout(() => (keyState.jump = false), 100); }
        else { keyState.slide = true; setTimeout(() => (keyState.slide = false), 500); }
      }
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (!isGameActive()) return;
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const width = rect.width, height = rect.height;
    const leftZone = x < width * 0.33, rightZone = x > width * 0.66;
    const topZone = y < height * 0.33, bottomZone = y > height * 0.66;
    if (topZone && !leftZone && !rightZone) { keyState.jump = true; }
    else if (bottomZone && !leftZone && !rightZone) { keyState.slide = true; }
    else if (leftZone) { performLaneSwitch(1); }
    else if (rightZone) { performLaneSwitch(-1); }
  }

  function handlePointerUp(event: PointerEvent) {
    keyState.slide = false; keyState.jump = false;
  }

  return {
    handleKeyDown, handleKeyUp, handleTouchStart, handleTouchMove, handleTouchEnd,
    handlePointerDown, handlePointerUp, startGame, ensureIdle, dispose, reset,
  };
}
