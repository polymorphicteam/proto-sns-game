// src/components/world/environment.ts
import * as BABYLON from "babylonjs";

import { createWorldSegments, WorldSegments } from "./worldSegments";
import { createWorldScroll, WorldScrollController } from "./worldScroll";
import { createObstacleSystem, ObstacleController } from "../obstacles/obstacleSystem";
import { createCoinSystem, CoinController } from "./coinSystem";
import { createCurvedMaterial } from "./worldCurvature";



export interface EnvironmentController {
  obstacleController: ObstacleController;
  coinController: CoinController;
  dispose(): void;
}

// NOTE: Must match ORIGINAL signature exactly
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

  // Apply curvature to static environment meshes
  const curveMeshIfNeeded = (mesh: BABYLON.AbstractMesh) => {
    if (mesh.material && !(mesh.material instanceof BABYLON.ShaderMaterial)) {
      mesh.material = createCurvedMaterial(scene, mesh.material);
    }
  };

  world.groundSegments.forEach((seg) => {
    if (seg instanceof BABYLON.AbstractMesh) curveMeshIfNeeded(seg);
  });
  world.buildingSegments.forEach((seg) =>
    seg.getChildMeshes().forEach(curveMeshIfNeeded)
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
  // 3) COIN SYSTEM
  // ------------------------------------------------------
  const coinController: CoinController = createCoinSystem(
    scene,
    shadowGenerator,
    getScrollSpeed
  );

  // ------------------------------------------------------
  // 4) OBSTACLE SYSTEM (jump / duck / platform)
  // ------------------------------------------------------
  const obstacleController: ObstacleController = createObstacleSystem(
    scene,
    shadowGenerator,
    getScrollSpeed,
    coinController,
    {
      laneWidth: 25,
      laneCount: 3,
    }
  );

  // ------------------------------------------------------
  // 4) DISPOSE removes world + scroll observers
  // ------------------------------------------------------
  function dispose() {
    obstacleController.dispose();
    coinController.dispose();
    scrollController.dispose();
    world.dispose();
  }

  return { dispose, obstacleController, coinController };
}
