// src/components/world/environment.ts
import * as BABYLON from "@babylonjs/core";

import { createWorldSegments, WorldSegments } from "./worldSegments";
import { createWorldScroll, WorldScrollController } from "./worldScroll";
import { createObstacleSystem, ObstacleController } from "../obstacles/obstacleSystem";
import { createCoinSystem, CoinController } from "./coinSystem";
import { createRoadsideCars, RoadsideCarsController } from "./roadsideCars";

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
  getScrollSpeed: () => number,
  onObstaclesReady?: () => void
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
  // 3) COIN SYSTEM
  // ------------------------------------------------------
  const coinController: CoinController = createCoinSystem(
    scene,
    shadowGenerator,
    getScrollSpeed
  );

  // ------------------------------------------------------
  // 4) ROADSIDE CARS (decorative parked cars)
  // ------------------------------------------------------
  const roadsideCarsController: RoadsideCarsController = createRoadsideCars(
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
    },
    onObstaclesReady
  );

  // ------------------------------------------------------
  // 4) DISPOSE removes world + scroll observers
  // ------------------------------------------------------
  function dispose() {
    obstacleController.dispose();
    coinController.dispose();
    roadsideCarsController.dispose();
    scrollController.dispose();
    world.dispose();
  }

  return { dispose, obstacleController, coinController };
}
