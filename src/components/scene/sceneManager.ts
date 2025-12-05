import * as BABYLON from "@babylonjs/core";

// -----------------------------------------------------------------------------
// SCENE SETUP
// -----------------------------------------------------------------------------
export function createScene(canvas: HTMLCanvasElement) {
    const engine = new BABYLON.Engine(canvas, true);

    // Logger config
    BABYLON.Logger.ClearLogCache();
    BABYLON.Logger.LogLevels = BABYLON.Logger.NoneLogLevel;

    const scene = new BABYLON.Scene(engine);

    return {
        engine,
        scene,
    };
}

// -----------------------------------------------------------------------------
// LIGHTING SETUP
// -----------------------------------------------------------------------------
export function createLighting(scene: BABYLON.Scene) {
    const hemisphericLight = new BABYLON.HemisphericLight(
        "hemilight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemisphericLight.intensity = 0.5;

    const directionalLight = new BABYLON.DirectionalLight(
        "dirLight",
        new BABYLON.Vector3(-0.5, -1, 0.5),
        scene
    );
    directionalLight.intensity = 1.5;

    const shadowGenerator = new BABYLON.ShadowGenerator(2048, directionalLight);
    shadowGenerator.useExponentialShadowMap = true;

    return {
        hemisphericLight,
        directionalLight,
        shadowGenerator,
        setDirectionalLightIntensity: (intensity: number) => {
            directionalLight.intensity = intensity;
        },
    };
}

// -----------------------------------------------------------------------------
// CAMERA SETUP
// -----------------------------------------------------------------------------
export function createCamera(
    scene: BABYLON.Scene,
    canvas: HTMLCanvasElement
) {
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI / 2,
        Math.PI / 3,
        25,
        new BABYLON.Vector3(0, 8, 0),
        scene
    );

    camera.attachControl(canvas, true);

    return { camera };
}

// -----------------------------------------------------------------------------
// SKY DOME SETUP
// -----------------------------------------------------------------------------
export function createSkyDome(scene: BABYLON.Scene, assetBase: string) {
    // Create a large sphere for the sky dome
    const skyDome = BABYLON.MeshBuilder.CreateSphere(
        "skyDome",
        {
            diameter: 5000,
            segments: 32,
            sideOrientation: BABYLON.Mesh.BACKSIDE // Render inside of sphere
        },
        scene
    );

    // Create material with cloud texture
    const skyMaterial = new BABYLON.StandardMaterial("skyMat", scene);
    const cloudTexture = new BABYLON.Texture(
        `${assetBase}sky_clouds.jpg`,
        scene,
        false,    // noMipmap
        false,    // invertY - false to flip right-side up
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE
    );

    // Tile the texture more for smaller clouds
    cloudTexture.uScale = 8;
    cloudTexture.vScale = 4;

    skyMaterial.diffuseTexture = cloudTexture;
    skyMaterial.emissiveTexture = cloudTexture; // Self-illuminated sky
    skyMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    skyMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // No specular
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true; // Sky doesn't need lighting

    skyDome.material = skyMaterial;
    skyDome.isPickable = false;
    skyDome.infiniteDistance = true; // Sky stays at infinite distance

    // Position sky dome at origin
    skyDome.position = BABYLON.Vector3.Zero();

    return { skyDome, skyMaterial, cloudTexture };
}
