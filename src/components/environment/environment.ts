// src/components/environment/environment.ts
import * as BABYLON from "babylonjs";

import { createRoadSystem, RoadSystem } from "./roadSystem";
import { createBuildingSystem, BuildingSystem } from "./buildingSystem";
import { createScrollSystem, ScrollSystem } from "./scrollSystem";

export interface EnvironmentController {
  dispose(): void;
}

export function setupEnvironment(
  scene: BABYLON.Scene,
  shadowGenerator: BABYLON.ShadowGenerator,
  modelRoot: string,
  textureRoot: string,
  getScrollSpeed: () => number
): EnvironmentController {

  // -----------------------------------
  // 1) ROAD SYSTEM (ground + textures)
  // -----------------------------------
  const roadSystem: RoadSystem = createRoadSystem(scene, textureRoot);

  // -----------------------------------
  // 2) BUILDING SYSTEM (b1…b10)
  // -----------------------------------
  const buildingSystem: BuildingSystem = createBuildingSystem(
    scene,
    shadowGenerator,
    modelRoot,
    roadSystem // because we need spacing from roadSystem when rebuilding ground
  );

  // -----------------------------------
  // 3) SCROLL SYSTEM (moves everything)
  // -----------------------------------
  const scrollSystem: ScrollSystem = createScrollSystem(
    scene,
    getScrollSpeed,
    roadSystem,
    buildingSystem
  );

  // -----------------------------------
  // DISPOSE
  // -----------------------------------
  function dispose() {
    scrollSystem.dispose();
    buildingSystem.dispose();
    roadSystem.dispose();
  }

  return {
    dispose
  };
}
