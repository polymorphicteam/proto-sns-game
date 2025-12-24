import { ObstacleType } from "./obstacleSystem";
import { getAssetRoots } from "../assetPaths";

export type ObstacleModelMap = Record<ObstacleType, string[]>;

// Static list of obstacle GLB files
const OBSTACLE_MODELS: Record<ObstacleType, string[]> = {
    jump: ["Burger.glb"],
    duck: ["pipe.glb"],
    platform: ["BurgerBox1.glb", "Container1.glb", "container2.glb"],
    insuperable: ["Fries.glb", "Soda1.glb", "WarningSign1.glb"],
    hamburger: [],
};

export function scanObstacleFolders(): ObstacleModelMap {
    const { modelRoot } = getAssetRoots();
    const baseUrl = `${modelRoot}obstacles/`;

    const modelMap: ObstacleModelMap = {
        jump: [],
        duck: [],
        platform: [],
        insuperable: [],
        hamburger: [],
    };

    // Build full URLs from static model list
    for (const type of Object.keys(OBSTACLE_MODELS) as ObstacleType[]) {
        const files = OBSTACLE_MODELS[type];
        for (const file of files) {
            modelMap[type].push(`${baseUrl}${type}/${file}`);
        }
    }

    console.log("Obstacle Model Map:", modelMap);
    return modelMap;
}
