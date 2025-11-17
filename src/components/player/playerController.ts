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
  ensureIdle(): void;
  dispose(): void;
}

export function setupPlayerController(
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  modelRoot: string,
  shadowGenerator: BABYLON.ShadowGenerator,
  setScrollSpeed: (speed: number) => void
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
  // GAME FLOW (start → run)
  // ------------------------------------------
  let gameStarted = false;
  let startTimerActive = false;
  let startTime = 0;
  const START_DELAY = 3000; // 3 secondi

  // ------------------------------------------
  // PLAYER ROOT + STATE MACHINE
  // ------------------------------------------
  let playerRoot: BABYLON.TransformNode | null = null;
  let stateMachine: ReturnType<typeof createPlayerStateMachine> | null = null;

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

      stateMachine = createPlayerStateMachine({
        scene,
        playerRoot: info.playerRoot,
        playerSkeleton: info.playerSkeleton,
        animationGroup: info.playerAnimationGroup,
        setScrollSpeed,
      });

      ensureIdle();

      // Dopo load → parte timer Idle → Run
      startTimerActive = true;
      startTime = performance.now();
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
    if (keyState.jump) {
      stateMachine.setPlayerState("Jump");
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
    // START TIMER INITIALE
    // -----------------------
    if (startTimerActive) {
      const now = performance.now();
      if (now - startTime >= START_DELAY) {
        startTimerActive = false;
        gameStarted = true;
        stateMachine.setPlayerState("Run", true);
      }
      return; // resta in Idle finché non scade il timer
    }

    // -----------------------
    // LOGICA ENDLESS:
    // se non siamo in Fall/Getup → siamo sempre in Run
    // -----------------------
    const cur = stateMachine.currentState;
    if (cur !== "Fall" && cur !== "Getup") {
      stateMachine.setPlayerState("Run");
    }
  }

  // ------------------------------------------
  // MAIN UPDATE LOOP
  // ------------------------------------------
  scene.onBeforeRenderObservable.add(() => {
    if (!playerRoot) return;

    updateMovementState();

    // Restart idle → run dopo restart (solo se Idle NON da debug)
    if (
      !startTimerActive &&
      stateMachine?.currentState === "Idle" &&
      !gameStarted
    ) {
      startTimerActive = true;
      startTime = performance.now();
    }

    // Lerp corsie
    playerRoot.position.x = BABYLON.Scalar.Lerp(
      playerRoot.position.x,
      targetX,
      lateralLerp
    );
  });

  function ensureIdle() {
    if (stateMachine) stateMachine.ensureIdle();
  }

  function dispose() {}

  return {
    handleKeyDown,
    handleKeyUp,
    ensureIdle,
    dispose,
  };
}
