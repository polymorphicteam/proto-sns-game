import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";

import { createScene, createLighting, createCamera, createSkyDome } from "./scene/sceneManager";
import { getAssetRoots } from "./assetPaths";
import { setupPlayerController } from "./player/playerController";
import { setupEnvironment } from "./world/environment";
import { createUIManager } from "./ui/uiManager";
import { useGameStore } from "../store/gameStore";

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
  const { assetBase, modelRoot, textureRoot } = getAssetRoots();

  // --------------------------------------------
  // SKY DOME
  // --------------------------------------------
  createSkyDome(scene, assetBase);

  // --------------------------------------------
  // TEST HAMBURGER (for preview)
  // --------------------------------------------
  import("./obstacles/hamburgerBuilder").then(({ buildHamburgerObstacle }) => {
    const testBurger = buildHamburgerObstacle(scene); // Uses default 0.75 scale
    testBurger.position.set(0, 0, -20); // Center, in front of player
    testBurger.receiveShadows = true;
    shadowGenerator.addShadowCaster(testBurger, true);
    console.log("🍔 Test hamburger spawned at (0, 0, -20)");
  });

  // --------------------------------------------
  // SCROLL SPEED SIGNAL
  // --------------------------------------------
  let currentScrollSpeed = 0;
  const setScrollSpeed = (s: number) => (currentScrollSpeed = s);
  const getScrollSpeed = () => currentScrollSpeed;

  // --------------------------------------------
  // LOADING STATE TRACKING
  // --------------------------------------------
  let playerReady = false;
  let obstaclesReady = false;

  function checkAllReady() {
    if (playerReady && obstaclesReady) {
      console.log("✅ All assets loaded - hiding loading screen");
      useGameStore.getState().setLoading(false);

      // Start visual countdown sequence: 3, 2, 1, GO!
      const sequence = [3, 2, 1, 0]; // 0 = "GO!"
      let i = 0;

      const tick = () => {
        useGameStore.getState().setCountdown(sequence[i]);
        i++;

        if (i < sequence.length) {
          setTimeout(tick, 1000);
        } else {
          // After "GO!", hide countdown and start game
          setTimeout(() => {
            useGameStore.getState().setCountdown(null);
            console.log("🏃 Starting game after countdown");
            player.startGame();
          }, 500);
        }
      };

      tick();
    }
  }

  // --------------------------------------------
  // ENVIRONMENT
  // --------------------------------------------
  const environment = setupEnvironment(
    scene,
    shadowGenerator,
    modelRoot,
    textureRoot,
    getScrollSpeed,
    () => {
      // Obstacles GLBs are ready
      obstaclesReady = true;
      console.log("✅ Obstacles ready");
      checkAllReady();
    }
  );

  // --------------------------------------------
  // UI MANAGER
  // --------------------------------------------
  const uiManager = createUIManager();

  // --------------------------------------------
  // PLAYER
  // --------------------------------------------
  const player = setupPlayerController(
    scene,
    camera,
    modelRoot,
    shadowGenerator,
    setScrollSpeed,
    environment.obstacleController,
    environment.coinController,
    () => {
      // Player model is ready
      playerReady = true;
      console.log("✅ Player ready");
      checkAllReady();
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
  const onTouchStart = (ev: TouchEvent) => player.handleTouchStart(ev);
  const onTouchMove = (ev: TouchEvent) => player.handleTouchMove(ev);
  const onTouchEnd = (ev: TouchEvent) => player.handleTouchEnd(ev);
  const onPointerDown = (ev: PointerEvent) => player.handlePointerDown(ev);
  const onPointerUp = (ev: PointerEvent) => player.handlePointerUp(ev);

  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);

  // --------------------------------------------
  // CLEANUP
  // --------------------------------------------
  window.addEventListener("beforeunload", () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);

    environment.dispose();
    player.dispose();
    uiManager.dispose();

    BABYLON.Logger.ClearLogCache();
    BABYLON.Logger.LogLevels = BABYLON.Logger.AllLogLevel;

    engine?.dispose();
  });

  return { engine, scene };
}
