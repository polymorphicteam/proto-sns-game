// src/components/environment/buildingSystem.ts
import * as BABYLON from "babylonjs";
import { RoadSystem } from "./roadSystem";

export interface BuildingSystem {
  buildingSegments: BABYLON.TransformNode[];
  spacing: number;
  rebuildBuildings: (spacing: number, count: number) => void;
  advanceBuildings: (movement: number) => void;
  dispose: () => void;
}

export function createBuildingSystem(
  scene: BABYLON.Scene,
  shadowGenerator: BABYLON.ShadowGenerator,
  modelRoot: string,
  roadSystem: RoadSystem
): BuildingSystem {
  const environmentScale = 8;
  const includeClonedSegments = true;
  const targetSegmentCount = includeClonedSegments ? 6 : 1;

  const buildingSegments: BABYLON.TransformNode[] = [];
  let buildingSegmentSpacing = 0;
  let buildingSegmentCount = targetSegmentCount;

  // ---------------------------------------------------
  // LOAD BUILDING MESHES (b1.glb … b10.glb)
  // ---------------------------------------------------
  const buildingModelFiles = Array.from(
    { length: 10 },
    (_, i) => `b${i + 1}.glb`
  );

  const loadBuildingMeshes = (file: string) =>
    BABYLON.SceneLoader.ImportMeshAsync(
      null,
      modelRoot,
      file,
      scene
    ).then((result) =>
      result.meshes.filter(
        (m): m is BABYLON.Mesh => m instanceof BABYLON.Mesh
      )
    );

  const meshTransforms = new Map<
    BABYLON.Mesh,
    {
      position: BABYLON.Vector3;
      rotation: BABYLON.Nullable<BABYLON.Vector3>;
      rotationQuaternion: BABYLON.Nullable<BABYLON.Quaternion>;
      scaling: BABYLON.Vector3;
    }
  >();

  // ---------------------------------------------------
  // APPLY ORIGINAL MESH TRANSFORMS TO INSTANCES
  // ---------------------------------------------------
  function applyTransform(
    target: BABYLON.AbstractMesh,
    source: BABYLON.Mesh
  ) {
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
  }

  // ---------------------------------------------------
  // CREATE BUILDING GROUP (A/B on each segment)
  // ---------------------------------------------------
  function createBuildingGroup(
    parent: BABYLON.TransformNode,
    name: string,
    rotationY: number,
    buildingMeshes: BABYLON.Mesh[]
  ) {
    const group = new BABYLON.TransformNode(name, scene);
    group.parent = parent;

    group.rotation = new BABYLON.Vector3(0, rotationY, 0);

    buildingMeshes.forEach((mesh) => {
      const instance = mesh.createInstance(`${mesh.name}-${name}`);
      instance.parent = group;
      applyTransform(instance, mesh);

      instance.receiveShadows = true;
      instance.alwaysSelectAsActiveMesh = false;
      shadowGenerator.addShadowCaster(instance, true);
    });

    return group;
  }

  // ---------------------------------------------------
  // REGISTER SEGMENT
  // ---------------------------------------------------
  function registerBuildingSegment(root: BABYLON.TransformNode, index: number) {
    root.position = new BABYLON.Vector3(0, 0, -index * buildingSegmentSpacing);
    buildingSegments.push(root);
  }

  // ---------------------------------------------------
  // ADVANCE BUILDINGS DURING SCROLL
  // ---------------------------------------------------
  function advanceBuildings(movement: number) {
    buildingSegments.forEach((seg) => {
      seg.position.z += movement;
    });

    let minZ = Infinity;
    buildingSegments.forEach((seg) => {
      if (seg.position.z < minZ) minZ = seg.position.z;
    });

    buildingSegments.forEach((seg) => {
      if (seg.position.z > buildingSegmentSpacing) {
        seg.position.z = minZ - buildingSegmentSpacing;
      }
    });
  }

  // ---------------------------------------------------
  // REBUILD BUILDINGS WHEN SPACING CHANGES
  // ---------------------------------------------------
  function rebuildBuildings(spacing: number, count: number) {
    buildingSegments.splice(0).forEach((s) => s.dispose());

    buildingSegmentSpacing = spacing;
    buildingSegmentCount = count;
  }

  // ---------------------------------------------------
  // LOAD AND CONSTRUCT BUILDING SYSTEM
  // ---------------------------------------------------
  Promise.all(buildingModelFiles.map(loadBuildingMeshes))
    .then((meshGroups) => {
      const buildingMeshes = meshGroups.flat();
      if (buildingMeshes.length === 0) {
        console.error("No renderable meshes found in building assets.");
        return;
      }

      // Save original transforms
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

      // Create base segment
      const baseRoot = new BABYLON.TransformNode("buildingsSeg-0", scene);
      baseRoot.position = BABYLON.Vector3.Zero();

      createBuildingGroup(baseRoot, "B_a_group_seg-0", 0, buildingMeshes);
      createBuildingGroup(baseRoot, "B_b_group_seg-0", Math.PI, buildingMeshes);

      // Compute spacing automatically
      const { min, max } = baseRoot.getHierarchyBoundingVectors();
      const rawSpacing = Math.abs(max.z - min.z);

      const overlapCompensation = 1;
      const spacing = Math.max(rawSpacing - overlapCompensation, 10);

      buildingSegmentSpacing = spacing;

      // Road system uses spacing → so rebuild ground
      roadSystem.rebuildGroundSegments(spacing, targetSegmentCount);

      // Register segments
      const register = (root: BABYLON.TransformNode, i: number) => {
        root.position = new BABYLON.Vector3(0, 0, -i * spacing);
        buildingSegments.push(root);
      };

      if (includeClonedSegments) {
        register(baseRoot, 0);

        for (let i = 1; i < targetSegmentCount; i++) {
          const segRoot = new BABYLON.TransformNode(
            `buildingsSeg-${i}`,
            scene
          );

          createBuildingGroup(segRoot, `B_a_group_seg-${i}`, 0, buildingMeshes);
          createBuildingGroup(
            segRoot,
            `B_b_group_seg-${i}`,
            Math.PI,
            buildingMeshes
          );

          register(segRoot, i);
        }
      } else {
        baseRoot.position = BABYLON.Vector3.Zero();
        register(baseRoot, 0);
      }
    })
    .catch((err) => console.error("Error loading building assets:", err));

  // ---------------------------------------------------
  // DISPOSE
  // ---------------------------------------------------
  function dispose() {
    buildingSegments.forEach((s) => s.dispose());
  }

  return {
    buildingSegments,
    spacing: buildingSegmentSpacing,
    advanceBuildings,
    rebuildBuildings,
    dispose,
  };
}
