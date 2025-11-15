// src/components/babylonRunner.ts  
// Versione finale senza React, completamente standalone

import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

// Draco configuration identical to old version
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
 * Tutto ciò che prima era dentro useEffect ora vive qui.
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


  applyCanvasSize();

  engine = new BABYLON.Engine(canvas, true);
  BABYLON.Logger.ClearLogCache();
  BABYLON.Logger.LogLevels = BABYLON.Logger.NoneLogLevel;

  updateHardwareScaling();

  const scene = new BABYLON.Scene(engine);
  const environmentScale = 8;

  const buildingSegments: BABYLON.TransformNode[] = [];
  const groundSegments: BABYLON.TransformNode[] = [];

  let buildingSegmentSpacing = 0;

  let scrollObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
  let playerMotionObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
;

  const baseScrollSpeed = 102;
  let activeScrollSpeed = 0;

  // -------------------------
  // PLAYER STATE MACHINE
  // -------------------------

  type PlayerState =
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

  const buildLoopRange = (state: LoopingState, scroll: number) => {
    const [start, end] = loopFrameRanges[state];
    return { start, end, loop: true, scroll };
  };

  const sourceFrameRate = 24;

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

  const blockingStates = new Set<PlayerState>([
    "Slide",
    "Jump",
    "Fall",
    "Getup",
  ]);

  const keyState = {
    forward: false,
    left: false,
    right: false,
    slide: false,
    jump: false,
  };

  const debugKeyMap = {
    Digit1: "Idle",
    Digit2: "Run",
    Digit3: "Slide",
    Digit4: "Jump",
    Digit5: "Run_Idle",
  } as const;

  let debugOverrideState: PlayerState | null = null;

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
      activeScrollSpeed = config.scroll;
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
      activeScrollSpeed = config.scroll;
      currentPlayerState = nextState;
      return;
    }

    activeScrollSpeed = config.scroll;
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
    const debugState = debugKeyMap[event.code as keyof typeof debugKeyMap];
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

  const lateralRange = 40;
  const lateralSpeed = 40;
  const lateralReturnSpeed = 40;
  const lateralClamp = (v: number) =>
    Math.max(-lateralRange, Math.min(lateralRange, v));
  const lateralState = { target: 0 };

  playerMotionObserver = scene.onBeforeRenderObservable.add(() => {
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

  // -------------------------
  // LIGHT + CAMERA + SHADOWS
  // -------------------------

  const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  light.intensity = 0.9;

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    25,
    new BABYLON.Vector3(0, 8, 0),
    scene
  );
  camera.attachControl(canvas, true);

  const shadowGenerator = new BABYLON.ShadowGenerator(
    2048,
    new BABYLON.DirectionalLight(
      "dirLight",
      new BABYLON.Vector3(-0.5, -1, 0.5),
      scene
    )
  );
  shadowGenerator.useExponentialShadowMap = true;

  const isGithubPages =
    typeof window !== "undefined" &&
    window.location.hostname.endsWith("github.io");

  const assetBase = isGithubPages
    ? "https://media.githubusercontent.com/media/elektrazone/INFIN_BBOY_REPO/main/public/scene/assets/"
    : "scene/assets/";

  const modelRoot = `${assetBase}model/`;
  const textureRoot = `${assetBase}road/`;

  // -------------------------
  // GROUND + ROAD TEXTURES
  // -------------------------

  const includeClonedSegments = true;
  const targetSegmentCount = includeClonedSegments ? 6 : 1;

  const groundWidth = 250;
  const groundLength = 160;
  let groundSegmentSpacing = groundLength;
  let groundSegmentCount = targetSegmentCount;

  const roadTextureRepeatPerSegment = 2;
  const getRoadTextureVScale = () =>
    Math.max(1, groundSegmentCount * roadTextureRepeatPerSegment);

  const stripePattern = {
    widthFraction: 0.005,
    heightFraction: 0.01,
    gapMultiplier: 1.0,
    startOffsetFraction: 0.0,
  };

  const groundMaterial = new BABYLON.StandardMaterial(
    "groundMaterial",
    scene
  );
  groundMaterial.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
  groundMaterial.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  groundMaterial.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.012);

  const createFallbackRoadTextures = () => {
    const packagedTextureUrl = `${textureRoot}fallback-road-texture.png`;

    const packagedTexture = new BABYLON.Texture(
      packagedTextureUrl,
      scene,
      undefined,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      undefined,
      () => packagedTexture.dispose()
    );

    packagedTexture.onLoadObservable.addOnce(() => {
      packagedTexture.updateSamplingMode(
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE
      );
    });

    const dynamicTexture = new BABYLON.DynamicTexture(
      "runner-road-fallback",
      { width: 1024, height: 1024 },
      scene,
      false
    );

    const ctx = dynamicTexture.getContext();
    if (ctx) {
      const size = 1024;
      ctx.fillStyle = "#201f2b";
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = "#14131d";
      ctx.fillRect(0, size * 0.08, size, size * 0.84);

      ctx.fillStyle = "#fcd75a";
      const stripeWidth = Math.max(
        1,
        Math.round(size * stripePattern.widthFraction)
      );
      const stripeHeight = Math.max(
        1,
        Math.round(size * stripePattern.heightFraction)
      );
      const stripeGap = Math.max(1, stripeHeight * stripePattern.gapMultiplier);
      const stripeX = (size - stripeWidth) / 2;

      for (
        let y = size * stripePattern.startOffsetFraction;
        y < size + stripeHeight;
        y += stripeHeight + stripeGap
      ) {
        ctx.fillRect(stripeX, y, stripeWidth, stripeHeight);
      }
    }

    dynamicTexture.update(false);

    return { packagedTexture, dynamicTexture };
  };

  const applyRoadTextureSettings = (t: BABYLON.Texture) => {
    t.uScale = 1;
    t.vScale = getRoadTextureVScale();
    t.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    t.hasAlpha = false;
  };

  const { packagedTexture, dynamicTexture } = createFallbackRoadTextures();

  applyRoadTextureSettings(dynamicTexture);
  groundMaterial.diffuseTexture = dynamicTexture;

  let activeRoadTexture: BABYLON.Texture = dynamicTexture;

  const groundTextureState = { offset: 0 };

  let roadTexture: BABYLON.Nullable<BABYLON.Texture> = null;

  const setActiveRoadTexture = (t: BABYLON.Texture) => {
    applyRoadTextureSettings(t);
    groundMaterial.diffuseTexture = t;
    activeRoadTexture = t;
  };

  packagedTexture.onLoadObservable.addOnce(() => {
    setActiveRoadTexture(packagedTexture);
  });

  const textureUrl = `${textureRoot}fallback-road-texture.png`;

  roadTexture = new BABYLON.Texture(
    textureUrl,
    scene,
    undefined,
    false,
    BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
    () => {
      if (roadTexture) setActiveRoadTexture(roadTexture);
    },
    () => {
      if (packagedTexture && packagedTexture.isReady())
        setActiveRoadTexture(packagedTexture);
      else setActiveRoadTexture(dynamicTexture);
    }
  );

  roadTexture.onLoadObservable.addOnce(() => {
    if (roadTexture) setActiveRoadTexture(roadTexture);
  });

  const createGroundSegment = (index: number, spacing: number) => {
    const ground = BABYLON.MeshBuilder.CreateGround(
      `ground-${index}`,
      { width: groundWidth, height: spacing },
      scene
    );
    ground.position = new BABYLON.Vector3(0, 0, -index * spacing);
    ground.material = groundMaterial;
    ground.receiveShadows = true;
    return ground;
  };

  const rebuildGroundSegments = (spacing: number, count: number) => {
    groundSegments.splice(0).forEach((s) => s.dispose());
    groundSegmentSpacing = spacing;
    groundSegmentCount = count;

    for (let i = 0; i < count; i++) {
      const ground = createGroundSegment(i, spacing);
      groundSegments.push(ground);
    }

    groundTextureState.offset = 0;
    applyRoadTextureSettings(activeRoadTexture);
  };

  rebuildGroundSegments(groundSegmentSpacing, groundSegmentCount);

  const advanceSegments = (
    segments: BABYLON.TransformNode[],
    spacing: number,
    movement: number
  ) => {
    segments.forEach((seg) => {
      seg.position.z += movement;
    });

    let minZ = Infinity;
    segments.forEach((seg) => {
      if (seg.position.z < minZ) minZ = seg.position.z;
    });

    segments.forEach((seg) => {
      if (seg.position.z > spacing) seg.position.z = minZ - spacing;
    });
  };

  scrollObserver = scene.onBeforeRenderObservable.add(() => {
    const delta = scene.getEngine().getDeltaTime() / 1000;
    const movement = activeScrollSpeed * delta;
    if (movement === 0) return;

    advanceSegments(groundSegments, groundSegmentSpacing, movement);

    if (buildingSegmentSpacing > 0)
      advanceSegments(buildingSegments, buildingSegmentSpacing, movement);

    groundTextureState.offset -= movement / groundSegmentSpacing;
    groundTextureState.offset %= 1;
    if (groundTextureState.offset < 0) groundTextureState.offset += 1;

    activeRoadTexture.vOffset = groundTextureState.offset;
  });

  // -------------------------
  // LOAD PLAYER
  // -------------------------

  const assetRoot = modelRoot;

  BABYLON.SceneLoader.ImportMesh(
    null,
    assetRoot,
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
        animationGroups.find((g) => g.targetedAnimations.length > 0) ??
        null;

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

  // -------------------------
  // LOAD BUILDINGS
  // -------------------------

  const buildingModelFiles = Array.from(
    { length: 10 },
    (_, i) => `b${i + 1}.glb`
  );

  const loadBuildingMeshes = (file: string) =>
    BABYLON.SceneLoader.ImportMeshAsync(
      null,
      assetRoot,
      file,
      scene
    ).then((result) =>
      result.meshes.filter(
        (m): m is BABYLON.Mesh => m instanceof BABYLON.Mesh
      )
    );

  Promise.all(buildingModelFiles.map(loadBuildingMeshes))
    .then((meshGroups) => {
      const buildingMeshes = meshGroups.flat();
      if (buildingMeshes.length === 0) {
        console.error("No renderable meshes found in b1–b10 assets.");
        return;
      }

      const meshTransforms = new Map<
        BABYLON.Mesh,
        {
          position: BABYLON.Vector3;
          rotation: BABYLON.Nullable<BABYLON.Vector3>;
          rotationQuaternion: BABYLON.Nullable<BABYLON.Quaternion>;
          scaling: BABYLON.Vector3;
        }
      >();

      buildingMeshes.forEach((mesh) => {
        mesh.scaling = mesh.scaling.scale(environmentScale);
        meshTransforms.set(mesh, {
          position: mesh.position.clone(),
          rotation: mesh.rotation?.clone() ?? null,
          rotationQuaternion: mesh.rotationQuaternion?.clone() ?? null,
          scaling: mesh.scaling.clone(),
        });

        mesh.isVisible = false;
        mesh.setEnabled(false);
      });

      const applyTransform = (
        target: BABYLON.AbstractMesh,
        source: BABYLON.Mesh
      ) => {
        const original = meshTransforms.get(source);
        if (!original) return;

        target.position = original.position.clone();
        target.scaling = original.scaling.clone();

        if (original.rotationQuaternion) {
          target.rotationQuaternion = original.rotationQuaternion.clone();
          target.rotation = BABYLON.Vector3.Zero();
        } else if (original.rotation) {
          target.rotation = original.rotation.clone();
          target.rotationQuaternion = null;
        }
      };

      const createBuildingGroup = (
        parent: BABYLON.TransformNode,
        name: string,
        rotationY: number
      ) => {
        const group = new BABYLON.TransformNode(name, scene);
        group.parent = parent;

        group.rotation = new BABYLON.Vector3(0, rotationY, 0);

        buildingMeshes.forEach((mesh) => {
          const instance = mesh.createInstance(`${mesh.name}-${name}`);
          instance.parent = group;
          applyTransform(instance, mesh);

          instance.receiveShadows = true;
          instance.alwaysSelectAsActiveMesh = false;
        });

        return group;
      };

      const baseRoot = new BABYLON.TransformNode("buildingsSeg-0", scene);

      baseRoot.position = BABYLON.Vector3.Zero();

      createBuildingGroup(baseRoot, "B_a_group_seg-0", 0);
      createBuildingGroup(baseRoot, "B_b_group_seg-0", Math.PI);

      const { min, max } = baseRoot.getHierarchyBoundingVectors();
      const rawSpacing = Math.abs(max.z - min.z);

      const overlapCompensation = 1;
      const spacing = Math.max(rawSpacing - overlapCompensation, 10);

      buildingSegmentSpacing = spacing;

      const segmentCount = targetSegmentCount;

      rebuildGroundSegments(spacing, segmentCount);

      const registerBuildingSegment = (
        root: BABYLON.TransformNode,
        index: number
      ) => {
        root.position = new BABYLON.Vector3(0, 0, -index * spacing);
        buildingSegments.push(root);
      };

      const createSegment = (i: number) => {
        const segRoot = new BABYLON.TransformNode(
          `buildingsSeg-${i}`,
          scene
        );
        segRoot.position = new BABYLON.Vector3(0, 0, -i * spacing);

        createBuildingGroup(segRoot, `B_a_group_seg-${i}`, 0);
        createBuildingGroup(segRoot, `B_b_group_seg-${i}`, Math.PI);

        registerBuildingSegment(segRoot, i);
      };

      if (includeClonedSegments) {
        registerBuildingSegment(baseRoot, 0);

        for (let i = 1; i < segmentCount; i++) createSegment(i);
      } else {
        baseRoot.position = BABYLON.Vector3.Zero();
        registerBuildingSegment(baseRoot, 0);
      }
    })
    .catch((err) => {
      console.error("Error loading building assets:", err);
    });

  // -------------------------
  // MAIN RENDER LOOP
  // -------------------------

  engine.runRenderLoop(() => {
    ensureIdle();
    scene.render();
  });

  // -------------------------
  // EVENT HANDLERS
  // -------------------------

  window.addEventListener("resize", applyCanvasSize);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // -------------------------
  // CLEANUP on page unload
  // -------------------------

  window.addEventListener("beforeunload", () => {
    window.removeEventListener("resize", applyCanvasSize);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);

    if (scrollObserver)
      scene.onBeforeRenderObservable.remove(scrollObserver);

    if (playerMotionObserver)
      scene.onBeforeRenderObservable.remove(playerMotionObserver);

    stopCurrentAnimation();

    buildingSegments.forEach((s) => s.dispose());
    groundSegments.forEach((s) => s.dispose());

    BABYLON.Logger.ClearLogCache();
    BABYLON.Logger.LogLevels = BABYLON.Logger.AllLogLevel;

    engine?.dispose();
  });

  return { engine, scene };
}
