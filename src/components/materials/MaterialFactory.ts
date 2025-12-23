// src/components/materials/MaterialFactory.ts
import * as BABYLON from "@babylonjs/core";

/**
 * Centralized MaterialFactory
 * 
 * Single source of truth for all game materials.
 * Caches materials to avoid duplicates and ensure consistent appearance.
 */

// Material cache to reuse instances
const materialCache: Map<string, BABYLON.PBRMaterial> = new Map();

/**
 * Material configurations for consistent look
 */
const MATERIAL_CONFIGS = {
    ground: {
        albedoColor: new BABYLON.Color3(0.12, 0.12, 0.14),
        metallic: 0.0,
        roughness: 0.9,
    },
    building: {
        metallic: 0.0,
        roughness: 1.0,
    },
    coin: {
        albedoColor: new BABYLON.Color3(1, 0.8, 0),
        emissiveColor: new BABYLON.Color3(0.4, 0.3, 0),
        metallic: 1.0,
        roughness: 0.3,
    },
    obstacle: {
        metallic: 0.0,
        roughness: 0.9,
    },
    obstacleGLB: {
        // For GLB overrides - will use existing albedo but normalize PBR settings
        metallic: 0.0,
        roughness: 0.85,
    },
    // Hamburger component materials
    hamburger: {
        metallic: 0.0,
        roughness: 0.7,
    }
};

/**
 * Obstacle type color configurations
 */
const OBSTACLE_COLORS: Record<string, { albedo: BABYLON.Color3; emissive: BABYLON.Color3 }> = {
    jump: {
        albedo: new BABYLON.Color3(0.8, 0.2, 0.2),
        emissive: new BABYLON.Color3(0.2, 0.05, 0.05),
    },
    duck: {
        albedo: new BABYLON.Color3(0.2, 0.6, 0.9),
        emissive: new BABYLON.Color3(0.05, 0.15, 0.25),
    },
    platform: {
        albedo: new BABYLON.Color3(0.35, 0.8, 0.4),
        emissive: new BABYLON.Color3(0.08, 0.2, 0.1),
    },
    insuperable: {
        albedo: new BABYLON.Color3(0.5, 0.2, 0.8),
        emissive: new BABYLON.Color3(0.1, 0.05, 0.2),
    },
};

/**
 * Hamburger component color configurations
 */
const HAMBURGER_COLORS: Record<string, { albedo: BABYLON.Color3; emissive?: BABYLON.Color3 }> = {
    bun: {
        albedo: new BABYLON.Color3(0.85, 0.55, 0.25),
    },
    patty: {
        albedo: new BABYLON.Color3(0.35, 0.2, 0.1),
    },
    cheese: {
        albedo: new BABYLON.Color3(1.0, 0.8, 0.2),
    },
    lettuce: {
        albedo: new BABYLON.Color3(0.3, 0.7, 0.2),
    },
    tomato: {
        albedo: new BABYLON.Color3(0.9, 0.2, 0.15),
    },
    sesame: {
        albedo: new BABYLON.Color3(0.95, 0.92, 0.8),
    },
};

/**
 * Get or create ground material
 */
export function getGroundMaterial(scene: BABYLON.Scene): BABYLON.PBRMaterial {
    const key = "groundPBR";
    if (materialCache.has(key)) {
        return materialCache.get(key)!;
    }

    const mat = new BABYLON.PBRMaterial(key, scene);
    mat.albedoColor = MATERIAL_CONFIGS.ground.albedoColor;
    mat.metallic = MATERIAL_CONFIGS.ground.metallic;
    mat.roughness = MATERIAL_CONFIGS.ground.roughness;

    materialCache.set(key, mat);
    return mat;
}

/**
 * Get or create coin material
 */
export function getCoinMaterial(scene: BABYLON.Scene): BABYLON.PBRMaterial {
    const key = "coinPBR";
    if (materialCache.has(key)) {
        return materialCache.get(key)!;
    }

    const mat = new BABYLON.PBRMaterial(key, scene);
    mat.albedoColor = MATERIAL_CONFIGS.coin.albedoColor;
    mat.emissiveColor = MATERIAL_CONFIGS.coin.emissiveColor;
    mat.metallic = MATERIAL_CONFIGS.coin.metallic;
    mat.roughness = MATERIAL_CONFIGS.coin.roughness;

    materialCache.set(key, mat);
    return mat;
}

/**
 * Get or create obstacle material for fallback/code-generated obstacles
 */
export function getObstacleMaterial(
    scene: BABYLON.Scene,
    type: string
): BABYLON.PBRMaterial {
    const key = `obstaclePBR_${type}`;
    if (materialCache.has(key)) {
        return materialCache.get(key)!;
    }

    const colors = OBSTACLE_COLORS[type] || OBSTACLE_COLORS.jump;
    const mat = new BABYLON.PBRMaterial(key, scene);
    mat.albedoColor = colors.albedo;
    mat.emissiveColor = colors.emissive;
    mat.metallic = MATERIAL_CONFIGS.obstacle.metallic;
    mat.roughness = MATERIAL_CONFIGS.obstacle.roughness;

    materialCache.set(key, mat);
    return mat;
}

/**
 * Get or create building material
 */
export function getBuildingMaterial(
    scene: BABYLON.Scene,
    originalColor?: BABYLON.Color3
): BABYLON.PBRMaterial {
    // For buildings, we use the original color if provided
    const colorKey = originalColor
        ? `${originalColor.r.toFixed(2)}_${originalColor.g.toFixed(2)}_${originalColor.b.toFixed(2)}`
        : "default";
    const key = `buildingPBR_${colorKey}`;

    if (materialCache.has(key)) {
        return materialCache.get(key)!;
    }

    const mat = new BABYLON.PBRMaterial(key, scene);
    mat.albedoColor = originalColor ?? BABYLON.Color3.White();
    mat.metallic = MATERIAL_CONFIGS.building.metallic;
    mat.roughness = MATERIAL_CONFIGS.building.roughness;

    materialCache.set(key, mat);
    return mat;
}

/**
 * Apply unified material settings to a GLB mesh
 * This preserves all original textures from the GLB
 */
export function applyUnifiedMaterialToGLBMesh(
    mesh: BABYLON.AbstractMesh,
    scene: BABYLON.Scene,
    type?: string
): void {
    const mat = mesh.material;

    if (!mat) return;

    // If already PBRMaterial, preserve all textures - only adjust metallic/roughness if no maps exist
    if (mat instanceof BABYLON.PBRMaterial) {
        // Only override metallic/roughness if no texture maps are defined
        if (!mat.metallicTexture) {
            mat.metallic = MATERIAL_CONFIGS.obstacleGLB.metallic;
        }
        if (!mat.metallicTexture && !mat.microSurfaceTexture) {
            mat.roughness = MATERIAL_CONFIGS.obstacleGLB.roughness;
        }
        // Keep all other textures as-is (albedo, normal, emissive, etc.)
        return;
    }

    // Convert StandardMaterial to PBRMaterial while preserving textures
    if (mat instanceof BABYLON.StandardMaterial) {
        const pbr = new BABYLON.PBRMaterial(`${mat.name}_unified`, scene);

        // Preserve all textures from StandardMaterial
        if (mat.diffuseTexture) {
            pbr.albedoTexture = mat.diffuseTexture;
        }
        if (mat.bumpTexture) {
            pbr.bumpTexture = mat.bumpTexture;
        }
        if (mat.emissiveTexture) {
            pbr.emissiveTexture = mat.emissiveTexture;
        }
        if (mat.ambientTexture) {
            pbr.ambientTexture = mat.ambientTexture;
        }
        if (mat.specularTexture) {
            pbr.reflectivityTexture = mat.specularTexture;
        }

        // Use original colors from the material
        pbr.albedoColor = mat.diffuseColor ?? BABYLON.Color3.White();
        pbr.emissiveColor = mat.emissiveColor ?? BABYLON.Color3.Black();
        pbr.metallic = MATERIAL_CONFIGS.obstacleGLB.metallic;
        pbr.roughness = MATERIAL_CONFIGS.obstacleGLB.roughness;

        mesh.material = pbr;
    }
}

/**
 * Apply unified materials to all meshes in a hierarchy
 */
export function applyUnifiedMaterialsToHierarchy(
    root: BABYLON.AbstractMesh,
    scene: BABYLON.Scene,
    type?: string
): void {
    applyUnifiedMaterialToGLBMesh(root, scene, type);

    const children = root.getChildMeshes(false);
    for (const child of children) {
        applyUnifiedMaterialToGLBMesh(child, scene, type);
    }
}

/**
 * Get or create hamburger component material
 */
export function getHamburgerMaterial(
    scene: BABYLON.Scene,
    component: string
): BABYLON.PBRMaterial {
    const key = `hamburger_${component}`;
    if (materialCache.has(key)) {
        return materialCache.get(key)!;
    }

    const colors = HAMBURGER_COLORS[component] || HAMBURGER_COLORS.bun;
    const mat = new BABYLON.PBRMaterial(key, scene);
    mat.albedoColor = colors.albedo;
    mat.emissiveColor = colors.emissive ?? BABYLON.Color3.Black();
    mat.metallic = MATERIAL_CONFIGS.hamburger.metallic;
    mat.roughness = MATERIAL_CONFIGS.hamburger.roughness;

    materialCache.set(key, mat);
    return mat;
}

/**
 * Get the unified PBR material for hamburgers
 * Uses Vertex Colors for component differentiation
 */
export function getHamburgerUnifiedMaterial(scene: BABYLON.Scene): BABYLON.PBRMaterial {
    const key = "hamburgerUnifiedPBR";
    if (materialCache.has(key)) {
        return materialCache.get(key)!;
    }

    const mat = new BABYLON.PBRMaterial(key, scene);
    // mat.useVertexColors = true; // Not a direct property on PBRMaterial in some versions, mesh.useVertexColors handles this
    mat.metallic = 0.0;
    mat.roughness = 0.9;

    materialCache.set(key, mat);
    return mat;
}

/**
 * Clear material cache (useful for scene disposal)
 */
export function clearMaterialCache(): void {
    materialCache.forEach((mat) => mat.dispose());
    materialCache.clear();
}
