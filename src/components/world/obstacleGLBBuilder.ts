import { Scene, AbstractMesh, SceneLoader, AssetContainer, Vector3, BoundingInfo } from "babylonjs";
import { ObstacleType } from "./obstacleSystem";
import { ObstacleModelMap } from "./obstacleModelScanner";
import { createCurvedMaterial } from "./worldCurvature";

export class ObstacleGLBBuilder {
    private static cache: Record<ObstacleType, AssetContainer[]> = {
        jump: [],
        duck: [],
        platform: [],
        insuperable: [],
    };

    private static loaded = false;

    public static async preloadAll(scene: Scene, modelMap: ObstacleModelMap): Promise<void> {
        if (this.loaded) return;

        const loadPromises: Promise<void>[] = [];

        for (const typeKey in modelMap) {
            const type = typeKey as ObstacleType;
            const urls = modelMap[type];

            for (const url of urls) {
                // Load the GLB file
                // We use LoadAssetContainerAsync to keep it isolated and cloneable
                const p = SceneLoader.LoadAssetContainerAsync("", url, scene, null, ".glb")
                    .then((container) => {
                        // Process meshes in the container if needed (e.g. merge, setup)
                        // But usually we just cache the container
                        this.cache[type].push(container);
                    })
                    .catch((err) => {
                        console.error(`Failed to load obstacle GLB [${type}]: ${url}`, err);
                    });

                loadPromises.push(p);
            }
        }

        await Promise.all(loadPromises);
        this.loaded = true;
        console.log("Obstacle GLBs preloaded:", this.cache);
    }

    public static getMesh(type: ObstacleType, scene: Scene): AbstractMesh | null {
        const containers = this.cache[type];

        if (!containers || containers.length === 0) {
            return null; // Fallback to default builder
        }

        // Pick a random container
        const randomIndex = Math.floor(Math.random() * containers.length);
        const container = containers[randomIndex];

        // Instantiate models from the container
        const entries = container.instantiateModelsToScene((name) => name, false, { doNotInstantiate: false });
        const root = entries.rootNodes[0];

        if (!root) {
            console.warn(`Empty GLB container for ${type}`);
            return null;
        }

        // The root might be a __root__ node or the mesh itself.
        // We need to ensure we return a single mesh that represents the obstacle.
        // If it's a hierarchy, we might want to parent it to a new mesh or return the root.

        // Ensure the root is an AbstractMesh
        const mesh = root as AbstractMesh;

        // Apply curvature to all meshes in the hierarchy
        // We use createCurvedMaterial which preserves textures
        mesh.getChildMeshes(false).forEach((child) => {
            if (child.material) {
                child.material = createCurvedMaterial(scene, child.material);
            }
        });

        if (mesh.material) {
            mesh.material = createCurvedMaterial(scene, mesh.material);
        }

        // Fix rotation/scaling if needed? 
        // Usually GLBs come in with Z-forward, Y-up.
        // Our game assumes Z-forward.

        // Calculate bounding box to position it correctly
        // We need to normalize the position so the bottom is at y=0 (or whatever the game expects)
        // The game expects the mesh pivot/position to be handled by the spawner.
        // But the default builders return a mesh where position.y is set.

        // Let's reset position to 0,0,0 relative to parent
        mesh.position.setAll(0);

        // FORCE BOUNDING INFO UPDATE FOR COLLISIONS
        // The player controller uses mesh.getBoundingInfo() to detect collisions.
        // GLB roots often have empty bounding boxes. We need to encapsulate the entire hierarchy.

        // 1. Ensure world matrix is up to date
        mesh.computeWorldMatrix(true);

        // 2. Get hierarchy bounds in world space
        const { min, max } = mesh.getHierarchyBoundingVectors();

        // 3. Convert to local space (since BoundingInfo expects local coordinates)
        // Since we just reset position to 0,0,0 and rotation is identity, 
        // local bounds are roughly equal to world bounds relative to the pivot.
        // However, to be precise, we should transform them back if the root had transforms.
        // But here we know root is at 0,0,0.

        // Create new BoundingInfo
        const newBoundingInfo = new BoundingInfo(min, max);

        // 4. Apply to mesh
        mesh.setBoundingInfo(newBoundingInfo);

        // 5. Force update again just in case
        mesh.computeWorldMatrix(true);

        return mesh;
    }
}
