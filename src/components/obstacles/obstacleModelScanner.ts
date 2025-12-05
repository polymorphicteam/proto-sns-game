import { ObstacleType } from "./obstacleSystem";

export type ObstacleModelMap = Record<ObstacleType, string[]>;

export function scanObstacleFolders(): ObstacleModelMap {
    const modelMap: ObstacleModelMap = {
        jump: [],
        duck: [],
        platform: [],
        insuperable: [],
        hamburger: [],
    };

    try {
        // Scan the obstacles directory recursively
        // The context is relative to THIS file
        // We want to scan ../../../public/scene/assets/model/obstacles
        // But require.context arguments must be literals.
        // Webpack will replace this at build time.
        // We assume the structure: public/scene/assets/model/obstacles/<type>/<file>.glb

        // Note: require.context behavior depends on the build tool (Webpack).
        // We use a broad scan and filter by path.
        const context = (require as any).context(
            "../../../public/scene/assets/model/obstacles",
            true,
            /\.glb$/
        );

        context.keys().forEach((key: string) => {
            // key is like "./jump/myModel.glb" or "./duck/subfolder/model.glb"

            // Extract type from folder name
            // Remove leading "./"
            const cleanKey = key.replace(/^\.\//, "");
            const parts = cleanKey.split("/");

            if (parts.length >= 2) {
                const type = parts[0] as ObstacleType;

                // Check if it's a valid obstacle type
                if (type in modelMap) {
                    // Resolve the full URL (Webpack handles this via asset/resource)
                    const modelUrl = context(key);
                    modelMap[type].push(modelUrl);
                }
            }
        });

        console.log("Obstacle Model Scan Results:", modelMap);

    } catch (e) {
        console.warn("Failed to scan obstacle folders (require.context might not be available):", e);
    }

    return modelMap;
}
