// src/components/player/playerController.ts
import * as BABYLON from "babylonjs";

import { loadPlayerModel } from "./playerModel";
import {
  PlayerState,
  createPlayerStateMachine,
} from "./playerStateMachine";

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

    // Lerp corsie
    playerRoot.position.x = BABYLON.Scalar.Lerp(
      playerRoot.position.x,
      targetX,
      lateralLerp
    );

    updateJumpMotion(dt);

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
