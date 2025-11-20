import {
    ShaderMaterial,
    Material,
    Scene,
    Effect,
    Color3,
    Vector3,
    Vector4,
    Texture,
} from "babylonjs";

export let curvatureStrength = 0.003;

export function setCurvatureStrength(v: number) {
    curvatureStrength = v;
}

export function registerCurvedWorldShaders() {
    Effect.ShadersStore["curvedVertexShader"] = curvedVertexShader;
    Effect.ShadersStore["curvedFragmentShader"] = curvedFragmentShader;
}

export function createCurvedMaterial(scene: Scene, originalMaterial: Material, strength = curvatureStrength) {
    const mat = new ShaderMaterial(
        "curvedWorldMaterial",
        scene,
        {
            vertex: "curved",
            fragment: "curved"
        },
        {
            attributes: ["position", "normal", "uv"],
            uniforms: [
                "world",
                "viewProjection",
                "curvatureStrength",
                "baseColor",
                "emissiveColor",
                "alpha",
                "alphaCutoff",
                "useAlphaTest",
                "useDiffuse",
                "useAlbedo",
                "useOpacity",
                "useEmissive",
            ],
            samplers: [
                "diffuseSampler",
                "albedoSampler",
                "opacitySampler",
                "emissiveSampler",
                "metallicRoughnessSampler",
                "normalSampler",
            ],
            needAlphaBlending: originalMaterial.needAlphaBlending(),
            needAlphaTesting: originalMaterial.needAlphaTesting()
        }
    );

    const asAny = originalMaterial as any;

    // Preserve culling/wireframe flags when present
    if (typeof asAny.backFaceCulling === "boolean") {
        mat.backFaceCulling = asAny.backFaceCulling;
    }
    if (typeof asAny.wireframe === "boolean") {
        mat.wireframe = asAny.wireframe;
    }

    // Base colors
    const baseColorSource: Color3 =
        asAny.diffuseColor ??
        asAny.albedoColor ??
        Color3.White();

    const emissiveColor: Color3 = asAny.emissiveColor ?? Color3.Black();
    const alpha: number = typeof asAny.alpha === "number" ? asAny.alpha : 1;
    const alphaCutoff: number =
        typeof asAny.alphaCutOff === "number" ? asAny.alphaCutOff : 0.4;

    mat.alpha = alpha;
    mat.setVector4(
        "baseColor",
        new Vector4(baseColorSource.r, baseColorSource.g, baseColorSource.b, 1)
    );
    mat.setVector3(
        "emissiveColor",
        new Vector3(emissiveColor.r, emissiveColor.g, emissiveColor.b)
    );
    mat.setFloat("alpha", alpha);
    mat.setFloat("alphaCutoff", alphaCutoff);
    mat.setFloat("useAlphaTest", mat.needAlphaTesting() ? 1 : 0);

    // Textures
    const diffuseTexture: Texture | undefined = asAny.diffuseTexture;
    const albedoTexture: Texture | undefined =
        asAny.albedoTexture ?? asAny.baseTexture;
    const opacityTexture: Texture | undefined = asAny.opacityTexture;
    const emissiveTexture: Texture | undefined = asAny.emissiveTexture;
    const metallicRoughnessTexture: Texture | undefined =
        asAny.metallicTexture ?? asAny.metallicRoughnessTexture;
    const normalTexture: Texture | undefined =
        asAny.normalTexture ?? asAny.bumpTexture;

    if (diffuseTexture) {
        mat.setTexture("diffuseSampler", diffuseTexture);
        mat.setFloat("useDiffuse", 1);
    } else {
        mat.setFloat("useDiffuse", 0);
    }

    if (albedoTexture) {
        mat.setTexture("albedoSampler", albedoTexture);
        mat.setFloat("useAlbedo", 1);
    } else {
        mat.setFloat("useAlbedo", 0);
    }

    if (opacityTexture) {
        mat.setTexture("opacitySampler", opacityTexture);
        mat.setFloat("useOpacity", 1);
    } else {
        mat.setFloat("useOpacity", 0);
    }

    if (emissiveTexture) {
        mat.setTexture("emissiveSampler", emissiveTexture);
        mat.setFloat("useEmissive", 1);
    } else {
        mat.setFloat("useEmissive", emissiveColor.equals(Color3.Black()) ? 0 : 1);
    }

    if (metallicRoughnessTexture) {
        mat.setTexture("metallicRoughnessSampler", metallicRoughnessTexture);
    }

    if (normalTexture) {
        mat.setTexture("normalSampler", normalTexture);
    }

    mat.setFloat("curvatureStrength", strength);

    return mat;
}

export const curvedVertexShader = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 world;
uniform mat4 viewProjection;
uniform float curvatureStrength;

varying vec2 vUV;

void main() {
    vec4 worldPos = world * vec4(position, 1.0);

    float curve = worldPos.z * curvatureStrength;
    worldPos.y -= curve * curve;

    gl_Position = viewProjection * worldPos;
    vUV = uv;
}
`;

export const curvedFragmentShader = `
precision highp float;
varying vec2 vUV;

uniform sampler2D diffuseSampler;
uniform sampler2D albedoSampler;
uniform sampler2D opacitySampler;
uniform sampler2D emissiveSampler;
uniform sampler2D metallicRoughnessSampler;
uniform sampler2D normalSampler;

uniform vec4 baseColor;
uniform vec3 emissiveColor;
uniform float alpha;
uniform float alphaCutoff;
uniform float useAlphaTest;
uniform float useDiffuse;
uniform float useAlbedo;
uniform float useOpacity;
uniform float useEmissive;

void main() {
    vec4 color = baseColor;

    if (useDiffuse > 0.5) {
        color *= texture2D(diffuseSampler, vUV);
    } else if (useAlbedo > 0.5) {
        color *= texture2D(albedoSampler, vUV);
    }

    if (useOpacity > 0.5) {
        color.a *= texture2D(opacitySampler, vUV).r;
    }

    color.a *= alpha;

    if (useAlphaTest > 0.5 && color.a < alphaCutoff) {
        discard;
    }

    vec3 emissive = emissiveColor;
    if (useEmissive > 0.5) {
        emissive += texture2D(emissiveSampler, vUV).rgb;
    }

    color.rgb += emissive;

    gl_FragColor = color;
}
`;
