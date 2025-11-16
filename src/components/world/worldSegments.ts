// src/components/world/worldSegments.ts
import * as BABYLON from "babylonjs";

export interface WorldSegments {
  groundSegments: BABYLON.TransformNode[];
  buildingSegments: BABYLON.TransformNode[];
  groundSpacing: number;
  buildingSpacing: number;

  // Road texture control
  getRoadOffset(): number;
  setRoadOffset(v: number): void;
  updateRoadTextureOffset(): void;

  // Movement helpers (used by env_scroll.ts)
  advanceGround(movement: number): void;
  advanceBuildings(movement: number): void;

  // Rebuild for spacing change
  rebuildGround(spacing: number, count: number): void;

  dispose(): void;
}

export function createWorldSegments(
  scene: BABYLON.Scene,
  shadowGenerator: BABYLON.ShadowGenerator,
  modelRoot: string,
  textureRoot: string
): WorldSegments {
  // CONFIG
  const targetSegmentCount = 6;
  const groundWidth = 250;
  const groundLength = 160;
  const environmentScale = 8;

  const groundSegments: BABYLON.TransformNode[] = [];
  const buildingSegments: BABYLON.TransformNode[] = [];

  let groundSpacing = groundLength;
  let buildingSpacing = 0;

  // ---------------------------------------------
  // ROAD MATERIAL + DYNAMIC TEXTURE
  // ---------------------------------------------
  const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
  groundMaterial.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
  groundMaterial.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  groundMaterial.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.012);

  const roadTextureState = { offset: 0 };
  const stripePattern = {
    widthFraction: 0.005,
    heightFraction: 0.01,
    gapMultiplier: 1.0,
    startOffsetFraction: 0.0,
  };

  const repeatPerSeg = 2;
  const getVScale = () => Math.max(1, targetSegmentCount * repeatPerSeg);

  function applyRoadTextureSettings(t: BABYLON.Texture) {
    t.uScale = 1;
    t.vScale = getVScale();
    t.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  }

  function createFallbackTextures() {
    const packagedUrl = `${textureRoot}fallback-road-texture.png`;

    const packagedTex = new BABYLON.Texture(
      packagedUrl,
      scene,
      undefined,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE
    );

    const dyn = new BABYLON.DynamicTexture(
      "roadDyn",
      { width: 1024, height: 1024 },
      scene,
      false
    );

    const ctx = dyn.getContext();
    if (ctx) {
      const size = 1024;
      ctx.fillStyle = "#201f2b";
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = "#14131d";
      ctx.fillRect(0, size * 0.08, size, size * 0.84);

      ctx.fillStyle = "#fcd75a";
      const w = Math.round(size * stripePattern.widthFraction);
      const h = Math.round(size * stripePattern.heightFraction);
      const gap = Math.round(h * stripePattern.gapMultiplier);
      const x = (size - w) / 2;

      for (let y = 0; y < size; y += h + gap) {
        ctx.fillRect(x, y, w, h);
      }
    }
    dyn.update(false);

    packagedTex.onLoadObservable.addOnce(() => {
      applyRoadTextureSettings(packagedTex);
      groundMaterial.diffuseTexture = packagedTex;
    });

    return { packagedTex, dynamicTex: dyn };
  }

  const { packagedTex, dynamicTex } = createFallbackTextures();

  // Use dynamic texture by default
  groundMaterial.diffuseTexture = dynamicTex;
  applyRoadTextureSettings(dynamicTex);

  let activeRoadTexture = dynamicTex;

  // ---------------------------------------------
  // GROUND SEGMENTS
  // ---------------------------------------------
  function createGroundSegment(i: number, spacing: number) {
    const g = BABYLON.MeshBuilder.CreateGround(
      `ground-${i}`,
      { width: groundWidth, height: spacing },
      scene
    );
    g.material = groundMaterial;
    g.receiveShadows = true;
    g.position.z = -i * spacing;
    return g;
  }

  function rebuildGround(spacing: number, count: number) {
    groundSegments.forEach((s) => s.dispose());
    groundSegments.length = 0;

    groundSpacing = spacing;

    for (let i = 0; i < count; i++) {
      const seg = createGroundSegment(i, spacing);
      groundSegments.push(seg);
    }

    roadTextureState.offset = 0;
    applyRoadTextureSettings(activeRoadTexture);
  }

  rebuildGround(groundSpacing, targetSegmentCount);

  function advanceGround(movement: number) {
    for (const g of groundSegments) g.position.z += movement;

    let minZ = Infinity;
    for (const g of groundSegments)
      if (g.position.z < minZ) minZ = g.position.z;

    for (const g of groundSegments) {
      if (g.position.z > groundSpacing)
        g.position.z = minZ - groundSpacing;
    }
  }

  // ---------------------------------------------
  // BUILDINGS (b1...b10)
  // ---------------------------------------------
  const buildingFiles = Array.from({ length: 10 }, (_, i) => `b${i + 1}.glb`);
  const meshDefaults = new Map<BABYLON.Mesh, any>();

  function applyTransform(inst: BABYLON.AbstractMesh, src: BABYLON.Mesh) {
    const t = meshDefaults.get(src);
    if (!t) return;

    inst.position = t.pos.clone();
    inst.scaling = t.scale.clone();

    if (t.rotQ) {
      inst.rotationQuaternion = t.rotQ.clone();
      inst.rotation = BABYLON.Vector3.Zero();
    } else if (t.rot) {
      inst.rotation = t.rot.clone();
      inst.rotationQuaternion = null;
    }
  }

  function createGroup(
    parent: BABYLON.TransformNode,
    name: string,
    rotY: number,
    meshes: BABYLON.Mesh[]
  ) {
    const group = new BABYLON.TransformNode(name, scene);
    group.parent = parent;
    group.rotation = new BABYLON.Vector3(0, rotY, 0);

    meshes.forEach((m) => {
      const inst = m.createInstance(`${m.name}-${name}`);
      inst.parent = group;
      applyTransform(inst, m);
      inst.receiveShadows = true;
      shadowGenerator.addShadowCaster(inst, true);
    });

    return group;
  }

  Promise.all(
    buildingFiles.map((f) =>
      BABYLON.SceneLoader.ImportMeshAsync(null, modelRoot, f, scene).then(
        (r) => r.meshes.filter((m): m is BABYLON.Mesh => m instanceof BABYLON.Mesh)
      )
    )
  )
    .then((groups) => {
      const meshes = groups.flat();
      if (meshes.length === 0) return;

      meshes.forEach((m) => {
        m.scaling = m.scaling.scale(environmentScale);
        meshDefaults.set(m, {
          pos: m.position.clone(),
          rot: m.rotation?.clone() ?? null,
          rotQ: m.rotationQuaternion?.clone() ?? null,
          scale: m.scaling.clone(),
        });
        m.isVisible = false;
        m.setEnabled(false);
      });

      const base = new BABYLON.TransformNode("buildSeg-0", scene);
      createGroup(base, "B_A0", 0, meshes);
      createGroup(base, "B_B0", Math.PI, meshes);

      const bbox = base.getHierarchyBoundingVectors();
      buildingSpacing = Math.max(Math.abs(bbox.max.z - bbox.min.z) - 1, 10);

      rebuildGround(buildingSpacing, targetSegmentCount);

      function register(seg: BABYLON.TransformNode, i: number) {
        seg.position = new BABYLON.Vector3(0, 0, -i * buildingSpacing);
        buildingSegments.push(seg);
      }

      register(base, 0);

      for (let i = 1; i < targetSegmentCount; i++) {
        const seg = new BABYLON.TransformNode(`buildSeg-${i}`, scene);
        createGroup(seg, `B_A${i}`, 0, meshes);
        createGroup(seg, `B_B${i}`, Math.PI, meshes);
        register(seg, i);
      }
    })
    .catch((e) => console.error("Buildings load error:", e));

  function advanceBuildings(movement: number) {
    for (const b of buildingSegments) b.position.z += movement;

    let minZ = Infinity;
    for (const b of buildingSegments)
      if (b.position.z < minZ) minZ = b.position.z;

    for (const b of buildingSegments) {
      if (b.position.z > buildingSpacing)
        b.position.z = minZ - buildingSpacing;
    }
  }

  // ---------------------------------------------
  // DISPOSE
  // ---------------------------------------------
  function dispose() {
    groundSegments.forEach((g) => g.dispose());
    buildingSegments.forEach((b) => b.dispose());
    dynamicTex.dispose();
    packagedTex.dispose();
    activeRoadTexture.dispose();
  }

  return {
    groundSegments,
    buildingSegments,
    groundSpacing,
    buildingSpacing,

    getRoadOffset: () => roadTextureState.offset,
    setRoadOffset: (v: number) => {
      roadTextureState.offset = v % 1;
      if (roadTextureState.offset < 0) roadTextureState.offset += 1;
    },
    updateRoadTextureOffset: () => {
      activeRoadTexture.vOffset = roadTextureState.offset;
    },

    advanceGround,
    advanceBuildings,

    rebuildGround,
    dispose,
  };
}
