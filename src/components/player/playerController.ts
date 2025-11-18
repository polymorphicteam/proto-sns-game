// src/components/player/playerController.ts
import * as BABYLON from "babylonjs";

import { loadPlayerModel } from "./playerModel";
import {
  PlayerState,
  createPlayerStateMachine,
} from "./playerStateMachine";
import { ObstacleController } from "../world/obstacleSystem";

type PlayerAABB = { min: BABYLON.Vector3; max: BABYLON.Vector3 };

export interface PlayerController {
  handleKeyDown(event: KeyboardEvent): void;
  handleKeyUp(event: KeyboardEvent): void;
  startGame(): void;
  ensureIdle(): void;
  dispose(): void;
}

export function setupPlayerController(
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  modelRoot: string,
  shadowGenerator: BABYLON.ShadowGenerator,
  setScrollSpeed: (speed: number) => void,
  obstacleController: ObstacleController,
  onReady?: () => void
): PlayerController {
  // ------------------------------------------
  // INPUT STATE
  // ------------------------------------------
  const keyState = {
    forward: false, // NON USATO più per il movimento
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

  const INVULNERABILITY_AFTER_HIT = 1.1;
  let invulnerabilityTimer = 0;

  // ------------------------------------------
  // KINEMATIC JUMP (parabolic, no physics engine)
  // ------------------------------------------
  const jumpMotion = {
    active: false,
    velocity: 0,
    gravity: -180, // units/sec^2
    jumpStrength: 70, // initial vertical velocity
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
  // PLAYER COLLIDER (AABB semplificato)
  // ------------------------------------------
  function computePlayerAABB(): PlayerAABB | null {
    if (!playerRoot || !playerCollider.initialized) return null;

    const isSliding = stateMachine?.currentState === "Slide";
    const height = isSliding
      ? playerCollider.slideHeight
      : playerCollider.standingHeight;
    const centerOffset = isSliding
      ? playerCollider.slideCenterOffsetY
      : playerCollider.centerOffsetY;

    const center = new BABYLON.Vector3(
      playerRoot.position.x,
      playerRoot.position.y + centerOffset,
      playerRoot.position.z
    );

    const halfHeight = height * 0.5;

    return {
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
  }

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
  // PLATFORM RAYCAST (landing on platforms)
  // ------------------------------------------
  function updatePlatformRaycast() {
    if (!playerRoot) return;

    const platformMeshes = obstacleController.getActivePlatformMeshes();
    const hasPlatforms = platformMeshes.length > 0;

    const rayOriginOffset = 2; // start slightly above player origin
    const rayLength = 40;
    const origin = playerRoot.position.add(
      new BABYLON.Vector3(0, rayOriginOffset, 0)
    );
    const ray = new BABYLON.Ray(origin, new BABYLON.Vector3(0, -1, 0), rayLength);

    const hit = scene.pickWithRay(ray, (mesh) => {
      const metaType =
        (mesh.metadata as { obstacleType?: string } | undefined)?.obstacleType ||
        (mesh.parent &&
          (mesh.parent.metadata as { obstacleType?: string } | undefined)
            ?.obstacleType);
      return metaType === "platform";
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
  // COLLISIONE OSTACOLI (AABB vs AABB)
  // ------------------------------------------
  function triggerFallState() {
    if (!stateMachine) return;
    const current = stateMachine.currentState;
    if (current === "Fall" || current === "Getup") return;

    jumpMotion.active = false;
    jumpMotion.velocity = 0;
    invulnerabilityTimer = INVULNERABILITY_AFTER_HIT;
    stateMachine.setPlayerState("Fall", true);
  }

  function checkObstacleCollision(): boolean {
    if (!playerRoot || !stateMachine) return false;
    if (invulnerabilityTimer > 0) return false;

    const playerBox = computePlayerAABB();
    if (!playerBox) return false;

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

      // Se siamo sopra la piattaforma, non contiamo collisione laterale
      if (obs.type === "platform") {
        const playerAbove = playerBox.min.y >= obsBox.max.y - platformTopTolerance;
        if (isOnPlatform || playerAbove) continue;
      }

      if (intersectsAABB(playerBox, obsBox)) {
        return true;
      }
    }

    return false;
  }

  // ------------------------------------------
  // LOAD MODEL
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
  // INPUT HANDLING
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

    switch (event.code) {

      // ⛔️ RIMOSSO: forward non serve più
      // case "ArrowUp":
      // case "KeyW":
      //   keyState.forward = true;
      //   break;

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

      // ⛔️ RIMOSSO: forward non serve più
      // case "ArrowUp":
      // case "KeyW":
      //   keyState.forward = false;
      //   break;

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
  // LANE SWITCH FUNCTION
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
  // STATE MACHINE UPDATE (ENDLESS RUN)
  // ------------------------------------------
  function updateMovementState() {
    if (!playerRoot || !stateMachine) return;
    if (debugOverrideState) return;
    const curState = stateMachine.currentState;
    if (curState === "Fall" || curState === "Getup") return;

    // -----------------------
    // JUMP
    // -----------------------
    if (keyState.jump && !jumpMotion.active) {
      stateMachine.setPlayerState("Jump");
      startJumpMotion();
      keyState.jump = false;
      return;
    }

    // -----------------------
    // SLIDE
    // -----------------------
    if (keyState.slide) {
      stateMachine.setPlayerState("Slide");
      return;
    }

    // -----------------------
    // GAME START (gestito da babylonRunner)
    // -----------------------
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

    // Lerp corsie
    playerRoot.position.x = BABYLON.Scalar.Lerp(
      playerRoot.position.x,
      targetX,
      lateralLerp
    );

    updatePlatformRaycast();
    updateJumpMotion(dt);

    if (!debugOverrideState) {
      if (stateMachine.currentState !== "Fall" && stateMachine.currentState !== "Getup") {
        const hit = checkObstacleCollision();
        if (hit) {
          triggerFallState();
        }
      }
    }

    // Quando abbiamo raggiunto la corsia target, rientriamo in Run
    if (!debugOverrideState) {
      const cur = stateMachine.currentState;
      const atTarget = Math.abs(playerRoot.position.x - targetX) < 0.5;
      if (gameStarted && atTarget && (cur === "Strafe_L" || cur === "Strafe_R")) {
        stateMachine.setPlayerState("Run");
      }
    }
  });

  function startGame() {
    requestedStart = true;
    gameStarted = true;
    if (stateMachine) stateMachine.setPlayerState("Run", true);
  }

  function ensureIdle() {
    if (stateMachine) stateMachine.ensureIdle();
  }

  function dispose() {}

  return {
    handleKeyDown,
    handleKeyUp,
    startGame,
    ensureIdle,
    dispose,
  };
}
