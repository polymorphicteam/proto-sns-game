// src/components/world/CurvedPBRPlugin.ts
import {
    MaterialPluginBase,
    PBRMaterial,
} from "@babylonjs/core";

/**
 * CurvedPBRPlugin — Babylon.js 7.x (compatibile con build senza registerForExtraDefines)
 *
 * Applica la curvatura del mondo modificando la world position nel vertex shader.
 * Funziona con PBRMaterial senza shader custom esterni.
 */
export class CurvedPBRPlugin extends MaterialPluginBase {
    public curvatureStrength: number = 0.008;

    constructor(material: PBRMaterial) {
        // 4th param MUST be an object (not boolean) in your Babylon build
        super(material, "CurvedPBRPlugin", 200, {});

        // Force shader compilation using this plugin
        this._enable(true);
    }

    /**
     * Inject code into vertex shader
     */
    getCustomCode(shaderType: string) {
        if (shaderType !== "vertex") return null;

        return {
            CUSTOM_VERTEX_DEFINITIONS: `
                #define CURVED_WORLD
                uniform float curvatureStrength;
            `,

            CUSTOM_VERTEX_MAIN_BEGIN: `
                #ifdef CURVED_WORLD
                    vec3 worldPosBefore = worldPos;
                #endif
            `,

            CUSTOM_VERTEX_BEFORE_POSITION_UPDATED: `
                #ifdef CURVED_WORLD
                    worldPos.y -= curvatureStrength * worldPos.z * worldPos.z;
                #endif
            `,

            CUSTOM_VERTEX_BEFORE_NORMAL_UPDATED: `
                #ifdef CURVED_WORLD
                    vec3 dz = vec3(0.0, -2.0 * curvatureStrength * worldPosBefore.z, 1.0);
                    vec3 dx = vec3(1.0, 0.0, 0.0);
                    vec3 newNormal = normalize(cross(dz, dx));
                    normalUpdated = normalize(normalUpdated + newNormal * 0.5);
                #endif
            `,
        };
    }

    /**
     * Uniforms required by plugin
     */
    getCustomUniforms() {
        return {
            ubo: [
                { name: "curvatureStrength", type: "float" },
            ],
        };
    }
}
