// src/components/world/obstacleSystem.ts
import * as BABYLON from "babylonjs";

export type ObstacleType = "jump" | "duck" | "platform";

export interface ObstacleSystemOptions {
  laneWidth?: number;
  laneCount?: number;
  spawnZ?: number;
  despawnZ?: number;
  minSpawnDelay?: number;
  maxSpawnDelay?: number;
}

export interface ObstacleController {
  dispose(): void;
}

interface ObstacleInstance {
  mesh: BABYLON.AbstractMesh;
  type: ObstacleType;
  active: boolean;
}

function createMaterial(
  scene: BABYLON.Scene,
  color: BABYLON.Color3,
  emissive: BABYLON.Color3
) {
  const mat = new BABYLON.StandardMaterial("obstacleMat", scene);
  mat.diffuseColor = color;
  mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  mat.emissiveColor = emissive;
  return mat;
}

function buildJumpObstacle(
  scene: BABYLON.Scene,
  material: BABYLON.Material
): BABYLON.Mesh {
  const mesh = BABYLON.MeshBuilder.CreateBox(
    "obs_jump",
    { width: 12, height: 12, depth: 14 },
    scene
  );
  mesh.material = material;
  mesh.position.y = 6;
  return mesh;
}

function buildDuckObstacle(
  scene: BABYLON.Scene,
  material: BABYLON.Material
): BABYLON.Mesh {
  const frame = BABYLON.MeshBuilder.CreateBox(
    "obs_duck",
    { width: 18, height: 6, depth: 10 },
    scene
  );
  frame.material = material;
  frame.position.y = 10;
  return frame;
}

function buildPlatformObstacle(
  scene: BABYLON.Scene,
  material: BABYLON.Material
): BABYLON.Mesh {
  // CONFIGURAZIONE AGGIORNATA
  // Altezza: 10 (Alta, ma superabile col salto max di 13.6)
  // Profondità: 90 (Lunga piattaforma)
  const width = 18;
  const height = 15; 
  const depth = 90;

  const platform = BABYLON.MeshBuilder.CreateBox(
    "obs_platform",
    { width, height, depth },
    scene
  );
  platform.material = material;

  // POSIZIONAMENTO
  // Alziamo il centro di metà dell'altezza affinché
  // la base tocchi esattamente y = 0
  platform.position.y = height / 2;

  return platform;
}

export function createObstacleSystem(
  scene: BABYLON.Scene,
  shadowGenerator: BABYLON.ShadowGenerator,
  getScrollSpeed: () => number,
  options: ObstacleSystemOptions = {}
): ObstacleController {
  const laneWidth = options.laneWidth ?? 25;
  const laneCount = options.laneCount ?? 3;
  const spawnZ = options.spawnZ ?? -520;
  const despawnZ = options.despawnZ ?? 200;
  const minSpawnDelay = options.minSpawnDelay ?? 1.2;
  const maxSpawnDelay = options.maxSpawnDelay ?? 2.6;

  const materials = {
    jump: createMaterial(
      scene,
      new BABYLON.Color3(0.8, 0.2, 0.2),
      new BABYLON.Color3(0.2, 0.05, 0.05)
    ),
    duck: createMaterial(
      scene,
      new BABYLON.Color3(0.2, 0.6, 0.9),
      new BABYLON.Color3(0.05, 0.15, 0.25)
    ),
    platform: createMaterial(
      scene,
      new BABYLON.Color3(0.35, 0.8, 0.4),
      new BABYLON.Color3(0.08, 0.2, 0.1)
    ),
  };

  const root = new BABYLON.TransformNode("obstacles_root", scene);

  const obstacleBuilders: Record<ObstacleType, () => BABYLON.Mesh> = {
    jump: () => buildJumpObstacle(scene, materials.jump),
    duck: () => buildDuckObstacle(scene, materials.duck),
    platform: () => buildPlatformObstacle(scene, materials.platform),
  };

  const obstaclePool: ObstacleInstance[] = [];
  const activeObstacles: ObstacleInstance[] = [];

  function acquire(type: ObstacleType) {
    const pooled = obstaclePool.find((o) => o.type === type && !o.active);
    if (pooled) {
      pooled.active = true;
      pooled.mesh.setEnabled(true);
      return pooled;
    }

    const mesh = obstacleBuilders[type]();
    mesh.parent = root;
    mesh.receiveShadows = true;
    shadowGenerator.addShadowCaster(mesh, true);

    const created: ObstacleInstance = { mesh, type, active: true };
    obstaclePool.push(created);
    return created;
  }

  function randomLaneX() {
    const half = Math.floor(laneCount / 2);
    const laneIndex = Math.floor(Math.random() * laneCount) - half;
    return laneIndex * laneWidth;
  }

  function pickRandomType(): ObstacleType {
    const roll = Math.random();
    if (roll < 0.34) return "jump";
    if (roll < 0.67) return "duck";
    return "platform";
  }

  let spawnTimer = 0;
  let nextSpawnDelay =
    minSpawnDelay +
    Math.random() * Math.max(0.1, maxSpawnDelay - minSpawnDelay);

  function spawnObstacle() {
    const type = pickRandomType();
    const obs = acquire(type);
    obs.mesh.position.set(randomLaneX(), obs.mesh.position.y, spawnZ);
    activeObstacles.push(obs);
  }

  const observer = scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    const speed = getScrollSpeed();
    if (speed <= 0) return;

    const movement = speed * dt;

    for (const obs of activeObstacles) {
      obs.mesh.position.z += movement;
    }

    for (let i = activeObstacles.length - 1; i >= 0; i--) {
      const obs = activeObstacles[i];
      if (obs.mesh.position.z > despawnZ) {
        obs.active = false;
        obs.mesh.setEnabled(false);
        activeObstacles.splice(i, 1);
      }
    }

    spawnTimer += dt;
    if (spawnTimer >= nextSpawnDelay) {
      spawnTimer = 0;
      nextSpawnDelay =
        minSpawnDelay +
        Math.random() * Math.max(0.1, maxSpawnDelay - minSpawnDelay);
      spawnObstacle();
    }
  });

  function dispose() {
    if (observer) {
      scene.onBeforeRenderObservable.remove(observer);
    }
    obstaclePool.forEach((o) => o.mesh.dispose());
    root.dispose();
  }

  return { dispose };
}
