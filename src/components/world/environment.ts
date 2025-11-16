// src/components/world/environment.ts
import * as BABYLON from "babylonjs";

import { createWorldSegments, WorldSegments } from "./worldSegments";
import { createWorldScroll, WorldScrollController } from "./worldScroll";



export interface EnvironmentController {
  dispose(): void;
}

// ⚠️ Must match ORIGINAL signature exactly
export function setupEnvironment(
  scene: BABYLON.Scene,
  shadowGenerator: BABYLON.ShadowGenerator,
  modelRoot: string,
  textureRoot: string,
  getScrollSpeed: () => number
): EnvironmentController {

  // ------------------------------------------------------
  // 1) CREATE STATIC WORLD (ground + buildings + roads)
  // ------------------------------------------------------
  const world: WorldSegments = createWorldSegments(
    scene,
    shadowGenerator,
    modelRoot,
    textureRoot
  );

  // ------------------------------------------------------
  // 2) CREATE SCROLL SYSTEM (movement + texture offset)
  // ------------------------------------------------------
  const scrollController: WorldScrollController = createWorldScroll(
    scene,
    world,
    getScrollSpeed
  );

  // ------------------------------------------------------
  // 3) DISPOSE → removes world + scroll observers
  // ------------------------------------------------------
  function dispose() {
    scrollController.dispose();
    world.dispose();
  }

  return { dispose };
}
