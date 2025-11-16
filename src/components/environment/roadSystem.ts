// src/components/environment/roadSystem.ts
import * as BABYLON from "babylonjs";

export interface RoadSystem {
  groundSegments: BABYLON.TransformNode[];
  spacing: number;
  getOffset(): number;
  setOffset(v: number): void;
  rebuildGroundSegments: (spacing: number, count: number) => void;
  advanceGroundSegments: (movement: number) => void;
  updateTextureOffset: () => void;
  dispose: () => void;
}

export function createRoadSystem(
  scene: BABYLON.Scene,
  textureRoot: string
): RoadSystem {
  // CONFIG
  const targetSegmentCount = 6;
  const groundWidth = 250;
  const groundLength = 160;

  // INTERNAL STATE
  const groundSegments: BABYLON.TransformNode[] = [];
  let groundSegmentSpacing = groundLength;
  let groundSegmentCount = targetSegmentCount;

  // TEXTURE OFFSET STATE
  const groundTextureState = { offset: 0 };

  // MATERIAL
  const groundMaterial = new BABYLON.StandardMaterial(
    "groundMaterial",
    scene
  );
  groundMaterial.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
  groundMaterial.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  groundMaterial.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.012);

  // ROAD TEXTURE LOGIC
  const stripePattern = {
    widthFraction: 0.005,
    heightFraction: 0.01,
    gapMultiplier: 1.0,
    startOffsetFraction: 0.0,
  };

  const roadTextureRepeatPerSegment = 2;
  const getRoadTextureVScale = () =>
    Math.max(1, groundSegmentCount * roadTextureRepeatPerSegment);

  function applyRoadTextureSettings(t: BABYLON.Texture) {
    t.uScale = 1;
    t.vScale = getRoadTextureVScale();
    t.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    t.hasAlpha = false;
  }

  // -------------------------------------------------
  // CREATE FALLBACK TEXTURES (Dynamic + PNG fallback)
  // -------------------------------------------------
  function createFallbackRoadTextures() {
    const packagedTextureUrl = `${textureRoot}fallback-road-texture.png`;

    const packagedTexture = new BABYLON.Texture(
      packagedTextureUrl,
      scene,
      undefined,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE
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
      const stripeGap = Math.max(
        1,
        stripeHeight * stripePattern.gapMultiplier
      );
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
  }

  const { packagedTexture, dynamicTexture } = createFallbackRoadTextures();

  applyRoadTextureSettings(dynamicTexture);
  groundMaterial.diffuseTexture = dynamicTexture;

  let activeRoadTexture: BABYLON.Texture = dynamicTexture;

  // packagedTexture fallback
  packagedTexture.onLoadObservable.addOnce(() => {
    activeRoadTexture = packagedTexture;
    groundMaterial.diffuseTexture = activeRoadTexture;
    applyRoadTextureSettings(activeRoadTexture);
  });

  // Explicit packagedTexture load for robustness
  const textureUrl = `${textureRoot}fallback-road-texture.png`;
  const fallbackTexture = new BABYLON.Texture(
    textureUrl,
    scene,
    undefined,
    false,
    BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
    () => {
      activeRoadTexture = fallbackTexture;
      groundMaterial.diffuseTexture = fallbackTexture;
      applyRoadTextureSettings(fallbackTexture);
    },
    () => {
      activeRoadTexture = packagedTexture.isReady()
        ? packagedTexture
        : dynamicTexture;

      groundMaterial.diffuseTexture = activeRoadTexture;
      applyRoadTextureSettings(activeRoadTexture);
    }
  );

  // -------------------------------------------------
  // GROUND SEGMENT CREATION
  // -------------------------------------------------
  function createGroundSegment(idx: number, spacing: number) {
    const g = BABYLON.MeshBuilder.CreateGround(
      `ground-${idx}`,
      { width: groundWidth, height: spacing },
      scene
    );
    g.material = groundMaterial;
    g.position = new BABYLON.Vector3(0, 0, -idx * spacing);
    g.receiveShadows = true;
    return g;
  }

  function rebuildGroundSegments(spacing: number, count: number) {
    groundSegments.splice(0).forEach((s) => s.dispose());
    groundSegmentSpacing = spacing;
    groundSegmentCount = count;

    for (let i = 0; i < count; i++) {
      const seg = createGroundSegment(i, spacing);
      groundSegments.push(seg);
    }

    groundTextureState.offset = 0;
    applyRoadTextureSettings(activeRoadTexture);
  }

  rebuildGroundSegments(groundSegmentSpacing, groundSegmentCount);

  // -------------------------------------------------
  // SCROLL MOVEMENT FOR GROUND
  // -------------------------------------------------
  function advanceGroundSegments(movement: number) {
    groundSegments.forEach((seg) => {
      seg.position.z += movement;
    });

    let minZ = Infinity;
    groundSegments.forEach((g) => {
      if (g.position.z < minZ) minZ = g.position.z;
    });

    groundSegments.forEach((g) => {
      if (g.position.z > groundSegmentSpacing) {
        g.position.z = minZ - groundSegmentSpacing;
      }
    });
  }

  function updateTextureOffset() {
    activeRoadTexture.vOffset = groundTextureState.offset;
  }

  // -------------------------------------------------
  // DISPOSE
  // -------------------------------------------------
  function dispose() {
    groundSegments.forEach((s) => s.dispose());
    activeRoadTexture.dispose();
    packagedTexture.dispose();
    dynamicTexture.dispose();
    fallbackTexture.dispose();
  }

  return {
    groundSegments,
    spacing: groundSegmentSpacing,

    getOffset: () => groundTextureState.offset,
    setOffset: (v: number) => {
      groundTextureState.offset = v;
      groundTextureState.offset %= 1;
      if (groundTextureState.offset < 0)
        groundTextureState.offset += 1;
    },

    rebuildGroundSegments,
    advanceGroundSegments,
    updateTextureOffset,
    dispose,
  };
}
