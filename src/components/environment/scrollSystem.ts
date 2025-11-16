// src/components/environment/scrollSystem.ts
import * as BABYLON from "babylonjs";
import { RoadSystem } from "./roadSystem";
import { BuildingSystem } from "./buildingSystem";

export interface ScrollSystem {
  dispose(): void;
}

export function createScrollSystem(
  scene: BABYLON.Scene,
  getScrollSpeed: () => number,
  roadSystem: RoadSystem,
  buildingSystem: BuildingSystem
): ScrollSystem {
  let scrollObserver: BABYLON.Nullable<
    BABYLON.Observer<BABYLON.Scene>
  > = null;

  // ---------------------------------------------------
  // MAIN SCROLL LOGIC
  // ---------------------------------------------------
  scrollObserver = scene.onBeforeRenderObservable.add(() => {
    const engine = scene.getEngine();
    const delta = engine.getDeltaTime() / 1000;
    const movement = getScrollSpeed() * delta;

    if (movement === 0) return;

    // Move ground segments
    roadSystem.advanceGroundSegments(movement);

    // Move building segments
    buildingSystem.advanceBuildings(movement);

    // Update road texture offset
    const newOffset = roadSystem.getOffset() - movement / roadSystem.spacing;
    roadSystem.setOffset(newOffset);
    roadSystem.updateTextureOffset();
  });

  // ---------------------------------------------------
  // DISPOSE
  // ---------------------------------------------------
  function dispose() {
    if (scrollObserver) {
      scene.onBeforeRenderObservable.remove(scrollObserver);
    }
  }

  return {
    dispose,
  };
}
