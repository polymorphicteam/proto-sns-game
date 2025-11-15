// src/components/sceneSetup.ts
import * as BABYLON from "babylonjs";

export interface SceneSetupResult {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.ArcRotateCamera;
  shadowGenerator: BABYLON.ShadowGenerator;
}

export function createScene(canvas: HTMLCanvasElement): SceneSetupResult {
  const engine = new BABYLON.Engine(canvas, true);

  // Logger config come nell'originale
  BABYLON.Logger.ClearLogCache();
  BABYLON.Logger.LogLevels = BABYLON.Logger.NoneLogLevel;

  const scene = new BABYLON.Scene(engine);

  // LIGHT
  const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  light.intensity = 0.9;

  // CAMERA
  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    25,
    new BABYLON.Vector3(0, 8, 0),
    scene
  );
  camera.attachControl(canvas, true);

  // SHADOWS
  const dirLight = new BABYLON.DirectionalLight(
    "dirLight",
    new BABYLON.Vector3(-0.5, -1, 0.5),
    scene
  );
  const shadowGenerator = new BABYLON.ShadowGenerator(2048, dirLight);
  shadowGenerator.useExponentialShadowMap = true;

  return { engine, scene, camera, shadowGenerator };
}
