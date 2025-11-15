// src/components/playerController.ts
import * as BABYLON from "babylonjs";

export type PlayerState =
  | "Idle"
  | "Run"
  | "Strafe_L"
  | "Strafe_R"
  | "Slide"
  | "Jump"
  | "Fall"
  | "Getup"
  | "Run_Idle";

type AnimationRangeConfig = {
  start: number;
  end: number;
  loop: boolean;
  scroll: number;
};

type LoopingState = Extract<
  PlayerState,
  "Idle" | "Run" | "Strafe_L" | "Strafe_R"
>;

const loopFrameRanges: Record<LoopingState, [number, number]> = {
  Idle: [0, 88],
  Run: [89, 109],
  Strafe_L: [182, 201],
  Strafe_R: [202, 221],
};

const sourceFrameRate = 24;
const baseScrollSpeed = 102;

const animationRanges: Record<PlayerState, AnimationRangeConfig> = {
  Idle: buildLoopRange("Idle", 0),
  Run: buildLoopRange("Run", baseScrollSpeed),
  Slide: { start: 110, end: 154, loop: false, scroll: baseScrollSpeed },
  Jump: { start: 155, end: 181, loop: false, scroll: baseScrollSpeed },
  Strafe_L: buildLoopRange("Strafe_L", baseScrollSpeed),
  Strafe_R: buildLoopRange("Strafe_R", baseScrollSpeed),
  Run_Idle: { start: 222, end: 248, loop: false, scroll: 0 },
  Fall: { start: 249, end: 324, loop: false, scroll: baseScrollSpeed },
  Getup: { start: 325, end: 552, loop: false, scroll: baseScrollSpeed },
};

function buildLoopRange(state: LoopingState, scroll: number) {
  const [start, end] = loopFrameRanges[state];
  return { start, end, loop: true, scroll };
}

const blockingStates = new Set<PlayerState>([
  "Slide",
  "Jump",
  "Fall",
  "Getup",
]);

const debugKeyMap = {
  Digit1: "Idle",
  Digit2: "Run",
  Digit3: "Slide",
  Digit4: "Jump",
  Digit5: "Run_Idle",
} as const;

type DebugKey = keyof typeof debugKeyMap;

const lateralRange = 40;
const lateralSpeed = 40;
const lateralReturnSpeed = 40;

export interface PlayerController {
  handleKeyDown(event: KeyboardEvent): void;
  handleKeyUp(event: KeyboardEvent): void;
  ensureIdle(): void;
  dispose(): void;
}

export function setupPlayerController(
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  modelRoot: string,
  shadowGenerator: BABYLON.ShadowGenerator,
  setScrollSpeed: (speed: number) => void
): PlayerController {
  let playerSkeleton: BABYLON.Nullable<BABYLON.Skeleton> = null;
  let playerAnimationGroup: BABYLON.Nullable<BABYLON.AnimationGroup> = null;
  let playerAnimatable: BABYLON.Nullable<BABYLON.Animatable> = null;
  let currentPlayerState: PlayerState = "Idle";
  let idleInitialized = false;
  let blockingAction = false;

  let animationGroupFrameRate = sourceFrameRate;

  let playerAnimatableEndObserver: BABYLON.Nullable<
    BABYLON.Observer<BABYLON.Animatable>
  > = null;

  let playerAnimationGroupEndObserver: BABYLON.Nullable<
    BABYLON.Observer<BABYLON.AnimationGroup>
  > = null;

  let playerRoot: BABYLON.Nullable<BABYLON.TransformNode> = null;

  const keyState = {
    forward: false,
    left: false,
    right: false,
    slide: false,
    jump: false,
  };

  let debugOverrideState: PlayerState | null = null;

  const lateralState = { target: 0 };

  const ensureSkeletonRanges = (skeleton: BABYLON.Skeleton) => {
    (Object.keys(animationRanges) as PlayerState[]).forEach((state) => {
      if (!skeleton.getAnimationRange(state)) {
        const { start, end } = animationRanges[state];
        skeleton.createAnimationRange(state, start, end);
      }
    });
  };

  const resolveFrames = (
    state: PlayerState,
    fallback: AnimationRangeConfig
  ) => {
    if (playerSkeleton) {
      const namedRange = playerSkeleton.getAnimationRange(state);
      if (namedRange) {
        return { start: namedRange.from, end: namedRange.to };
      }
    }
    return { start: fallback.start, end: fallback.end };
  };

  const stopCurrentAnimation = () => {
    if (playerAnimatable && playerAnimatableEndObserver) {
      playerAnimatable.onAnimationEndObservable.remove(
        playerAnimatableEndObserver
      );
      playerAnimatableEndObserver = null;
    }
    if (playerAnimationGroup && playerAnimationGroupEndObserver) {
      playerAnimationGroup.onAnimationGroupEndObservable.remove(
        playerAnimationGroupEndObserver
      );
      playerAnimationGroupEndObserver = null;
    }
    if (playerAnimationGroup) playerAnimationGroup.stop();
    if (playerAnimatable) playerAnimatable.stop();
    playerAnimatable = null;
  };

  const setPlayerState = (nextState: PlayerState, force = false) => {
    if (!force && currentPlayerState === nextState) return;
    if (!force && blockingStates.has(currentPlayerState)) return;

    blockingAction = blockingStates.has(nextState);

    const config = animationRanges[nextState];
    const targetRange = resolveFrames(nextState, config);

    if (!playerSkeleton && !playerAnimationGroup) {
      setScrollSpeed(config.scroll);
      currentPlayerState = nextState;
      return;
    }

    stopCurrentAnimation();

    const handleAnimationEnd = () => {
      blockingAction = false;
      if (nextState === "Slide" || nextState === "Jump")
        setPlayerState("Run", true);
      else if (nextState === "Getup") setPlayerState("Idle", true);
      else if (nextState === "Run_Idle") setPlayerState("Idle", true);
    };

    let animationStarted = false;

    if (playerAnimationGroup) {
      const frameScale = animationGroupFrameRate / sourceFrameRate;
      const fromFrame = targetRange.start * frameScale;
      const toFrame = targetRange.end * frameScale;

      playerAnimationGroup.reset();
      playerAnimationGroup.start(
        config.loop,
        1,
        fromFrame,
        toFrame,
        false
      );

      animationStarted = true;

      if (!config.loop) {
        playerAnimationGroupEndObserver =
          playerAnimationGroup.onAnimationGroupEndObservable.addOnce(() => {
            playerAnimationGroupEndObserver = null;
            handleAnimationEnd();
          });
      }

      playerAnimatable = null;
    } else if (playerSkeleton) {
      playerAnimatable = scene.beginAnimation(
        playerSkeleton,
        targetRange.start,
        targetRange.end,
        config.loop,
        1
      );

      if (playerAnimatable) {
        animationStarted = true;
        if (!config.loop) {
          playerAnimatableEndObserver =
            playerAnimatable.onAnimationEndObservable.addOnce(() => {
              playerAnimatableEndObserver = null;
              handleAnimationEnd();
            });
        }
      }
    }

    if (!animationStarted) {
      setScrollSpeed(config.scroll);
      currentPlayerState = nextState;
      return;
    }

    setScrollSpeed(config.scroll);
    currentPlayerState = nextState;
  };

  const ensureIdle = () => {
    if (idleInitialized) return;

    const idleRange = resolveFrames("Idle", animationRanges.Idle);

    if (playerAnimationGroup) {
      const frameScale = animationGroupFrameRate / sourceFrameRate;
      const fromFrame = idleRange.start * frameScale;
      const toFrame = idleRange.end * frameScale;

      playerAnimationGroup.reset();
      playerAnimationGroup.start(true, 1, fromFrame, toFrame, true);

      idleInitialized = true;
      playerAnimatable = null;
    } else if (playerSkeleton) {
      playerAnimatable = scene.beginAnimation(
        playerSkeleton,
        idleRange.start,
        idleRange.end,
        true
      );
      if (playerAnimatable) idleInitialized = true;
    }
  };

  const triggerDebugState = (state: PlayerState | null) => {
    keyState.forward = false;
    keyState.left = false;
    keyState.right = false;
    keyState.slide = false;
    keyState.jump = false;

    debugOverrideState = state;

    if (state) setPlayerState(state, true);
    else setPlayerState("Idle", true);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const debugState = debugKeyMap[event.code as DebugKey];
    if (debugState) {
      event.preventDefault();
      triggerDebugState(debugState);
      return;
    }
    if (event.code === "Digit0") {
      event.preventDefault();
      triggerDebugState(null);
      return;
    }

    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        keyState.forward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        keyState.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        keyState.right = true;
        break;
      case "ArrowDown":
      case "KeyS":
        keyState.slide = true;
        break;
      case "Space":
        event.preventDefault();
        keyState.jump = true;
        break;
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        keyState.forward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        keyState.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        keyState.right = false;
        break;
      case "ArrowDown":
      case "KeyS":
        keyState.slide = false;
        break;
      case "Space":
        event.preventDefault();
        keyState.jump = false;
        break;
    }
  };

  const updateMovementState = () => {
    if (!playerRoot) return;
    if (debugOverrideState) return;

    const moveLeft = keyState.left && !keyState.right;
    const moveRight = keyState.right && !keyState.left;
    const shouldSlide = keyState.slide;
    const shouldRun = keyState.forward || blockingAction;

    let triggeredJump = false;

    if (keyState.jump) {
      if (!blockingAction) {
        setPlayerState("Jump");
        triggeredJump = true;
      }
      keyState.jump = false;
    }

    if (triggeredJump) return;

    if (shouldSlide) setPlayerState("Slide");
    else if (moveLeft) setPlayerState("Strafe_L");
    else if (moveRight) setPlayerState("Strafe_R");
    else if (shouldRun) setPlayerState("Run");
    else setPlayerState("Idle");
  };

  const lateralClamp = (v: number) =>
    Math.max(-lateralRange, Math.min(lateralRange, v));

  const playerMotionObserver = scene.onBeforeRenderObservable.add(() => {
    const deltaSeconds = scene.getEngine().getDeltaTime() / 1000;

    updateMovementState();
    if (!playerRoot) return;

    const targetPos = playerRoot.position.clone();

    if (keyState.left && !keyState.right) {
      lateralState.target = lateralClamp(
        lateralState.target - lateralSpeed * deltaSeconds
      );
    } else if (keyState.right && !keyState.left) {
      lateralState.target = lateralClamp(
        lateralState.target + lateralSpeed * deltaSeconds
      );
    } else {
      const direction = Math.sign(-lateralState.target);
      const adj = direction * lateralReturnSpeed * deltaSeconds;
      if (Math.abs(adj) > Math.abs(lateralState.target))
        lateralState.target = 0;
      else lateralState.target += adj;
    }

    targetPos.x = lateralState.target;
    playerRoot.position = targetPos;
  });

  // LOAD PLAYER
  BABYLON.SceneLoader.ImportMesh(
    null,
    modelRoot,
    "player.glb",
    scene,
    (meshes, particleSystems, skeletons, animationGroups) => {
      if (meshes.length === 0) {
        console.error("No meshes loaded from player.glb");
        return;
      }

      const root = new BABYLON.TransformNode("playerRoot", scene);

      meshes.forEach((mesh) => {
        mesh.parent = root;
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.setEnabled(true);

        if (mesh instanceof BABYLON.Mesh) {
          mesh.receiveShadows = true;
          shadowGenerator.addShadowCaster(mesh, true);
        }
      });

      const meshAnchor =
        meshes.find(
          (m): m is BABYLON.Mesh =>
            m instanceof BABYLON.Mesh && !!m.skeleton
        ) ??
        meshes.find(
          (m): m is BABYLON.Mesh => m instanceof BABYLON.Mesh
        ) ??
        null;

      const cameraAnchor = meshAnchor ?? meshes[0] ?? null;

      root.position = BABYLON.Vector3.Zero();
      root.scaling = BABYLON.Vector3.One();
      root.computeWorldMatrix(true);

      const skeleton =
        skeletons[0] || meshAnchor?.skeleton || null;

      const { min: rawMin, max: rawMax } = root.getHierarchyBoundingVectors();
      const rawHeight = rawMax.y - rawMin.y;
      const desiredHeight = 3.2 * 5;
      const scaleFactor = rawHeight > 0 ? desiredHeight / rawHeight : 1;

      root.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
      root.computeWorldMatrix(true);

      root.rotate(BABYLON.Axis.Y, Math.PI, BABYLON.Space.LOCAL);
      root.computeWorldMatrix(true);

      const { min: scaledMin, max: scaledMax } =
        root.getHierarchyBoundingVectors();
      const scaledCenter = scaledMin.add(scaledMax).scale(0.5);

      const verticalPadding = 0.05;
      const forwardOffset = 7.5;

      root.position = new BABYLON.Vector3(
        -scaledCenter.x,
        -scaledMin.y + verticalPadding,
        -scaledCenter.z + forwardOffset
      );
      root.computeWorldMatrix(true);

      if (cameraAnchor) camera.lockedTarget = cameraAnchor;
      else camera.setTarget(root.position.clone());

      playerRoot = root;
      playerSkeleton = skeleton;

      playerAnimationGroup =
        animationGroups.find((g) => g.targetedAnimations.length > 0) ?? null;

      animationGroups.forEach((g) => {
        if (g !== playerAnimationGroup) g.stop();
      });

      if (playerAnimationGroup) {
        const firstTarget = playerAnimationGroup.targetedAnimations[0];
        if (firstTarget?.animation?.framePerSecond)
          animationGroupFrameRate =
            firstTarget.animation.framePerSecond;

        playerAnimationGroup.reset();
      } else if (skeleton) {
        ensureSkeletonRanges(skeleton);
      }

      ensureIdle();
    },
    undefined,
    (scene, message, exception) => {
      console.error("Error loading player.glb:", message, exception);
    }
  );

  const dispose = () => {
    if (playerMotionObserver) {
      scene.onBeforeRenderObservable.remove(playerMotionObserver);
    }

    stopCurrentAnimation();

    if (playerRoot) {
      playerRoot.dispose();
      playerRoot = null;
    }

    playerSkeleton = null;
    playerAnimationGroup = null;
  };

  return {
    handleKeyDown,
    handleKeyUp,
    ensureIdle,
    dispose,
  };
}
