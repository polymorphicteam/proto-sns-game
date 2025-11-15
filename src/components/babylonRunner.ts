// src/components/babylonRunner.ts
// Versione modulare – orchestratore

import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

import { createScene } from "./sceneSetup";
import { getAssetRoots } from "./assetPaths";
import { setupPlayerController } from "./playerController";
import { setupEnvironment } from "./environment";

// Draco configuration identica alla versione originale
if (BABYLON.DracoCompression) {
  BABYLON.DracoCompression.Configuration = {
    decoder: {
      wasmUrl: "https://cdn.babylonjs.com/draco_wasm_wrapper_gltf.js",
      wasmBinaryUrl: "https://cdn.babylonjs.com/draco_wasm_wrapper_gltf.wasm",
      fallbackUrl: "https://cdn.babylonjs.com/draco_decoder_gltf.js",
    },
  };
}

/**
 * RUNNER 3D – funzione standalone.
 */
export function babylonRunner(canvas: HTMLCanvasElement) {
  if (!canvas) return;

  const maxHeight = 3840;
  const maxWidth = 2160;

  let engine: BABYLON.Engine | null = null;

  const updateHardwareScaling = () => {
    if (!engine) return;
    const resolutionScale = Math.max(1, canvas.height / 1080);
    engine.setHardwareScalingLevel(Math.min(2.5, resolutionScale));
  };

  const applyCanvasSize = () => {
    // Aspect ratio verticale 9:16
    const aspect = 9 / 16;

    const maxW = window.innerWidth;
    const maxH = window.innerHeight;

    // Primo tentativo: usare tutta l’altezza
    let height = maxH;
    let width = height * aspect;

    // Se la larghezza eccede lo schermo → ridurre
    if (width > maxW) {
      width = maxW;
      height = width / aspect;
    }

    // Limita eventuali dimensioni esagerate (come nel codice originale, anche se i const non venivano usati)
    if (height > maxHeight) height = maxHeight;
    if (width > maxWidth) width = maxWidth;

    // Applica dimensioni reali a Babylon
    canvas.width = width;
    canvas.height = height;

    // Applica dimensioni visuali CSS
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Aggiorna Babylon
    engine?.resize();
    updateHardwareScaling();
  };

  // Prima sizing del canvas
  applyCanvasSize();

  // Creazione scena/engine/camera/shadow
  const {
    engine: createdEngine,
    scene,
    camera,
    shadowGenerator,
  } = createScene(canvas);
  engine = createdEngine;

  updateHardwareScaling();

  // Asset paths (identici alla versione originale)
  const { modelRoot, textureRoot } = getAssetRoots();

  // Gestione velocità di scroll condivisa tra player e ambiente
  let currentScrollSpeed = 0;
  const setScrollSpeed = (speed: number) => {
    currentScrollSpeed = speed;
  };
  const getScrollSpeed = () => currentScrollSpeed;

  // ENVIRONMENT (ground + buildings + scroll)
  const environment = setupEnvironment(
    scene,
    shadowGenerator,
    modelRoot,
    textureRoot,
    getScrollSpeed
  );

  // PLAYER (state machine + input + animazioni)
  const player = setupPlayerController(
    scene,
    camera,
    modelRoot,
    shadowGenerator,
    setScrollSpeed
  );

  // MAIN RENDER LOOP (identico: garantiamo ensureIdle + render)
  engine.runRenderLoop(() => {
    player.ensureIdle();
    scene.render();
  });

  // EVENT HANDLERS
  const onResize = () => applyCanvasSize();
  const onKeyDown = (ev: KeyboardEvent) => player.handleKeyDown(ev);
  const onKeyUp = (ev: KeyboardEvent) => player.handleKeyUp(ev);

  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // CLEANUP on page unload (stessa logica della tua versione)
  window.addEventListener("beforeunload", () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);

    environment.dispose();
    player.dispose();

    BABYLON.Logger.ClearLogCache();
    BABYLON.Logger.LogLevels = BABYLON.Logger.AllLogLevel;

    engine?.dispose();
  });

  return { engine, scene };
}
