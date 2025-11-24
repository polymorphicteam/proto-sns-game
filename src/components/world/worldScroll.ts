// src/components/world/worldScroll.ts
import * as BABYLON from "babylonjs";
import { WorldSegments } from "./worldSegments";

import { useGameStore } from "../../store/gameStore";

export interface WorldScrollController {
  dispose(): void;
}

export function createWorldScroll(
  scene: BABYLON.Scene,
  world: WorldSegments,
  getScrollSpeed: () => number
): WorldScrollController {
  let scrollObs: BABYLON.Nullable<
    BABYLON.Observer<BABYLON.Scene>
  > = null;

  // -----------------------------------------------------------
  // SCROLL LOOP: moves ground + buildings + texture offset
  // -----------------------------------------------------------
  scrollObs = scene.onBeforeRenderObservable.add(() => {
    // FREEZE WORLD IF NOT PLAYING, UNLESS BOUNCE BACK (Game Over + Negative Speed)
    const state = useGameStore.getState().gameState;
    const speed = getScrollSpeed();
    const isBounceBack = state === "gameover" && speed < 0;

    if (state !== "playing" && !isBounceBack) return;

    const engine = scene.getEngine();
    const dt = engine.getDeltaTime() / 1000;

    if (speed === 0) return;

    const movement = speed * dt;

    // Move terrain ground
    world.advanceGround(movement);

    // Move building segments
    world.advanceBuildings(movement);

    // Update road texture vOffset
    const newOffset =
      world.getRoadOffset() - movement / world.groundSpacing;

    world.setRoadOffset(newOffset);
    world.updateRoadTextureOffset();
  });

  // -----------------------------------------------------------
  // DISPOSE: remove scroll observer, nothing else
  // -----------------------------------------------------------
  function dispose() {
    if (scrollObs) {
      scene.onBeforeRenderObservable.remove(scrollObs);
      scrollObs = null;
    }
  }

  return { dispose };
}
