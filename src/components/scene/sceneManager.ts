// src/components/scene/sceneManager.ts
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

    // Create environment texture for PBR reflections
    // This enables reflections on metallic/shiny surfaces
    scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env",
        scene
    );
    scene.environmentIntensity = 0.4; // Subtle reflections

    // Set background color to white
    scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

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
    hemisphericLight.intensity = 0.2; // Reduced from 0.5 for darker shadows

    const directionalLight = new BABYLON.DirectionalLight(
        "dirLight",
        new BABYLON.Vector3(-0.5, -1, 0.5),
        scene
    );
    directionalLight.position = new BABYLON.Vector3(20, 40, -30);
    directionalLight.intensity = 2.0; // Increased from 1.5 for higher contrast

    // Configure shadow generator
    const shadowGenerator = new BABYLON.ShadowGenerator(2048, directionalLight);
    shadowGenerator.usePercentageCloserFiltering = true; // Softer shadows
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
    shadowGenerator.bias = 0.001;
    shadowGenerator.normalBias = 0.02;

    // Configure shadow frustum for better coverage
    directionalLight.shadowMinZ = 1;
    directionalLight.shadowMaxZ = 200;

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
    const savedAlpha = localStorage.getItem("camera_alpha");
    const savedBeta = localStorage.getItem("camera_beta");
    const savedRadius = localStorage.getItem("camera_radius");
    const savedTargetX = localStorage.getItem("camera_target_x");
    const savedTargetY = localStorage.getItem("camera_target_y");
    const savedTargetZ = localStorage.getItem("camera_target_z");

    const startAlpha = savedAlpha ? parseFloat(savedAlpha) : Math.PI / 2;
    const startBeta = savedBeta ? parseFloat(savedBeta) : Math.PI / 2.5;
    const startRadius = savedRadius ? parseFloat(savedRadius) : 200;
    const startTargetX = savedTargetX ? parseFloat(savedTargetX) : 0;
    const startTargetY = savedTargetY ? parseFloat(savedTargetY) : 8;
    const startTargetZ = savedTargetZ ? parseFloat(savedTargetZ) : 0;

    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        startAlpha,
        startBeta,
        startRadius, // Radius increased to see more road (was 120)
        new BABYLON.Vector3(startTargetX, startTargetY, startTargetZ),
        scene
    );
    // 35mm Lens equivalent
    // Vertical FOV = 2 * atan(24mm / (2 * 35mm)) ~= 37.8 degrees ~= 0.66 radians
    // Wider Lens (approx 14-15mm)
    camera.fov = 1.5;

    // Enable camera orbit controls for debugging
    // attachControl(canvas, noPreventDefault, useCtrlForPanning)
    // Setting useCtrlForPanning to false enables Right-Click panning by default
    // Enable camera orbit controls for debugging
    camera.attachControl(canvas, true);

    // Explicitly configure mouse input for Right-Click Panning
    // We cast to any to avoid TypeScript errors with specific input properties
    const mouseInput = camera.inputs.attached["mouse"] as any;
    if (mouseInput) {
        mouseInput.useCtrlForPanning = false;
        mouseInput.buttons = [0, 1, 2]; // Allow all buttons
        mouseInput.panningMouseButton = 2; // Right click for panning
    }

    // Remove default keyboard input to prevent Arrow Keys from orbiting
    // We are handling Arrow Keys manually in babylonRunner.ts for panning
    // Remove default keyboard input to prevent Arrow Keys from orbiting
    // We are handling Arrow Keys manually in babylonRunner.ts for panning
    camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

    // NUCLEAR OPTION: Explicitly clear the key lists to prevent ANY default WASD/Arrow movement
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];

    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 200;

    // Enable Panning
    camera.panningSensibility = 50; // Lower is faster
    camera.panningAxis = new BABYLON.Vector3(1, 1, 0); // Allow panning on X and Y relative to camera

    // Explicitly configure mouse input to ensure Right Click (2) works
    // (Babylon 4.2+ sometimes needs this explicit mapping if defaults are weird)
    // Note: attachControl(canvas, true, false) should have handled this, 
    // but we can force it here if needed.
    // However, simplest fix is to allow all axis and ensure sensibility is set.

    // Ensure inputs are attached
    // camera.inputs.addMouse(); // Already added by default


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

// -----------------------------------------------------------------------------
// POST-PROCESS SETUP (Water Lens)
// -----------------------------------------------------------------------------
export function createLensEffect(scene: BABYLON.Scene, camera: BABYLON.Camera) {
    const lensEffect = new BABYLON.LensRenderingPipeline(
        "waterLens",
        {
            edge_blur: 0.5,
            chromatic_aberration: 2.0,      // High for watery look
            distortion: 0.8,                // Significant distortion
            dof_focus_distance: 200,        // Focus far away (player/road)
            dof_aperture: 3.0,              // Slight blur for depth
            grain_amount: 0.15,
            dof_pentagon: true,
            dof_gain: 1.0,
            dof_threshold: 1.0,
            dof_darken: 0.25
        },
        scene,
        1.0,
        [camera]
    );

    // If available in this version:
    // lensEffect.setAperture(3.0); 

    return { lensEffect };
}
