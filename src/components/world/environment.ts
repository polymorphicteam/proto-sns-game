// src/components/world/environment.ts
import * as BABYLON from "@babylonjs/core";

import { createWorldSegments, WorldSegments } from "./worldSegments";
import { createWorldScroll, WorldScrollController } from "./worldScroll";
import { createObstacleSystem, ObstacleController } from "../obstacles/obstacleSystem";
import { createCoinSystem, CoinController } from "./coinSystem";
import { createRoadsideCars, RoadsideCarsController } from "./roadsideCars";
import { createFallingCubeRoad, FallingCubeRoadController } from "./fallingCubeRoad";

export interface EnvironmentController {
  obstacleController: ObstacleController;
  coinController: CoinController;
  fallingCubeRoadController: FallingCubeRoadController;
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
  // 1) FALLING CUBE ROAD (dynamic obstacle cubes) - Created first to receive callbacks
  // ------------------------------------------------------
  const fallingCubeRoadController: FallingCubeRoadController = createFallingCubeRoad(
    scene,
    shadowGenerator,
    getScrollSpeed
  );

  // ------------------------------------------------------
  // 2) CREATE STATIC WORLD (ground + buildings + roads)
  // ------------------------------------------------------
  const world: WorldSegments = createWorldSegments(
    scene,
    shadowGenerator,
    modelRoot,
    textureRoot,
    (spacing) => {
      // Callback when building spacing is calculated
      console.log(`🏗️ World spacing ready: ${spacing}, rebuilding road...`);
      fallingCubeRoadController.rebuild(spacing);
    }
  );

  // ------------------------------------------------------
  // 3) CREATE SCROLL SYSTEM (movement + texture offset)
  // ------------------------------------------------------
  const scrollController: WorldScrollController = createWorldScroll(
    scene,
    world,
    getScrollSpeed
  );

  // ------------------------------------------------------
  // 4) COIN SYSTEM
  // ------------------------------------------------------
  const coinController: CoinController = createCoinSystem(
    scene,
    shadowGenerator,
    getScrollSpeed
  );

  // ------------------------------------------------------
  // 5) ROADSIDE CARS (decorative parked cars)
  // ------------------------------------------------------
  const roadsideCarsController: RoadsideCarsController = createRoadsideCars(
    scene,
    shadowGenerator,
    getScrollSpeed
  );

  // ------------------------------------------------------
  // 6) OBSTACLE SYSTEM (jump / duck / platform)
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
  // 6.5) LINK ROAD TO OBSTACLES (Prevent holes under obstacles)
  // ------------------------------------------------------
  fallingCubeRoadController.setObstacleChecker((x, z, laneWidth) => {
    return obstacleController.isGroundLocked(x, z, laneWidth);
  });

  // ------------------------------------------------------
  // 7) DISPOSE removes world + scroll observers
  // ------------------------------------------------------
  function dispose() {
    obstacleController.dispose();
    coinController.dispose();
    roadsideCarsController.dispose();
    fallingCubeRoadController.dispose();
    scrollController.dispose();
    world.dispose();
  }

  return { dispose, obstacleController, coinController, fallingCubeRoadController };
}
