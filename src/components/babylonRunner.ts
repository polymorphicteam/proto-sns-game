import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

import { createScene, createLighting, createCamera } from "./scene/sceneManager";
import { getAssetRoots } from "./assetPaths";
import { setupPlayerController } from "./player/playerController";
import { setupEnvironment } from "./world/environment";
import { createUIManager } from "./ui/uiManager";

// Draco configuration
if (BABYLON.DracoCompression) {
  BABYLON.DracoCompression.Configuration = {
    decoder: {
      wasmUrl: "https://cdn.babylonjs.com/draco_wasm_wrapper_gltf.js",
      wasmBinaryUrl: "https://cdn.babylonjs.com/draco_wasm_wrapper_gltf.wasm",
      fallbackUrl: "https://cdn.babylonjs.com/draco_decoder_gltf.js",
    },
  };
}

export function babylonRunner(canvas: HTMLCanvasElement) {
  if (!canvas) return;

  let engine: BABYLON.Engine | null = null;

  // --------------------------------------------
  // HARDWARE SCALING
  // --------------------------------------------
  const updateHardwareScaling = () => {
    if (!engine) return;
    const resolutionScale = Math.max(1, canvas.height / 1080);
    engine.setHardwareScalingLevel(Math.min(2.5, resolutionScale));
  };

  // --------------------------------------------
  // RESPONSIVE CANVAS
  // --------------------------------------------
  const applyCanvasSize = () => {
    const aspect = 9 / 16;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;

    let height = maxH;
    let width = height * aspect;

    if (width > maxW) {
      width = maxW;
      height = width / aspect;
    }

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    engine?.resize();
    updateHardwareScaling();
  };

  applyCanvasSize();

  // --------------------------------------------
  // SCENE + ENGINE
  // --------------------------------------------
  const { engine: createdEngine, scene } = createScene(canvas);
  engine = createdEngine;
  updateHardwareScaling();

  // --------------------------------------------
  // LIGHTING
  // --------------------------------------------
  const { shadowGenerator } = createLighting(scene);

  // --------------------------------------------
  // CAMERA
  // --------------------------------------------
  const { camera } = createCamera(scene, canvas);

  // --------------------------------------------
  // ASSETS ROOTS
  // --------------------------------------------
  const { modelRoot, textureRoot } = getAssetRoots();

  // --------------------------------------------
  // SCROLL SPEED SIGNAL
  // --------------------------------------------
  let currentScrollSpeed = 0;
  const setScrollSpeed = (s: number) => (currentScrollSpeed = s);
  const getScrollSpeed = () => currentScrollSpeed;

  // --------------------------------------------
  // ENVIRONMENT
  // --------------------------------------------
  const environment = setupEnvironment(
    scene,
    shadowGenerator,
    modelRoot,
    textureRoot,
    getScrollSpeed
  );

  // --------------------------------------------
  // UI MANAGER
  // --------------------------------------------
  const uiManager = createUIManager();

  // --------------------------------------------
  // PLAYER
  // --------------------------------------------
  const START_DELAY = 3000;
  let startTimeoutId: number | null = null;

  const player = setupPlayerController(
    scene,
    camera,
    modelRoot,
    shadowGenerator,
    setScrollSpeed,
    environment.obstacleController,
    environment.coinController,
    () => {
      // Auto-start after delay
      if (startTimeoutId !== null) clearTimeout(startTimeoutId);
      startTimeoutId = window.setTimeout(() => player.startGame(), START_DELAY);
    }
  );

  // --------------------------------------------
  // MAIN LOOP
  // --------------------------------------------
  engine.runRenderLoop(() => {
    player.ensureIdle();
    scene.render();
  });

  // --------------------------------------------
  // EVENTS
  // --------------------------------------------
  const onResize = () => applyCanvasSize();
  const onKeyDown = (ev: KeyboardEvent) => player.handleKeyDown(ev);
  const onKeyUp = (ev: KeyboardEvent) => player.handleKeyUp(ev);

  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // --------------------------------------------
  // CLEANUP
  // --------------------------------------------
  window.addEventListener("beforeunload", () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);

    environment.dispose();
    player.dispose();
    uiManager.dispose();

    if (startTimeoutId !== null) clearTimeout(startTimeoutId);

    BABYLON.Logger.ClearLogCache();
    BABYLON.Logger.LogLevels = BABYLON.Logger.AllLogLevel;

    engine?.dispose();
  });

  return { engine, scene };
}
