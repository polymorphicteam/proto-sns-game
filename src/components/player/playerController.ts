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
    forward: false,
    slide: false,
    jump: false,

    // NOTA: left/right non muovono più continuamente
    // ora servono solo come trigger per lane switching
    leftPressed: false,
    rightPressed: false
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
  const laneWidth = 25;          // distanza tra le corsie
  const maxLane = 1;            // corsie = -1, 0, +1
  let currentLane = 0;          // corsia attuale del player
  let targetX = 0;              // X da raggiungere
  const lateralLerp = 0.12;     // velocità interpolazione

  // ------------------------------------------
  // PLAYER ROOT HANDLE
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
    }
  );

  // ------------------------------------------
  // INPUT HANDLING
  // ------------------------------------------
  function handleKeyDown(event: KeyboardEvent) {
    // Debug state override
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
      case "ArrowUp":
      case "KeyW":
        keyState.forward = true;
        break;

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

      case "Space":
        event.preventDefault();
        keyState.jump = true;
        break;
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        keyState.forward = false;
        break;

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

      case "Space":
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

    // Nessuna corsia disponibile → non fare animazione
    if (previousLane === currentLane) return;

    // Nuova X target
    targetX = currentLane * laneWidth;

    // Animazioni di strafe come transizione
    if (dir > 0) stateMachine.setPlayerState("Strafe_R");
    else stateMachine.setPlayerState("Strafe_L");
  }

  // ------------------------------------------
  // STATE MACHINE UPDATE
  // ------------------------------------------
  function updateMovementState() {
    if (!playerRoot || !stateMachine) return;
    if (debugOverrideState) return;

    let triggeredJump = false;

    if (keyState.jump) {
      stateMachine.setPlayerState("Jump");
      triggeredJump = true;
      keyState.jump = false;
    }
    if (triggeredJump) return;

    if (keyState.slide) {
      stateMachine.setPlayerState("Slide");
      return;
    }

    if (keyState.forward) {
      stateMachine.setPlayerState("Run");
    } else {
      stateMachine.setPlayerState("Idle");
    }
  }

  // ------------------------------------------
  // MAIN UPDATE LOOP
  // ------------------------------------------
  scene.onBeforeRenderObservable.add(() => {
    if (!playerRoot) return;

    updateMovementState();

    // Lerp verso la X della corsia
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
