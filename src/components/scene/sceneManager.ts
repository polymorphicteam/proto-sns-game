import * as BABYLON from "babylonjs";
import { registerCurvedWorldShaders } from "../world/worldCurvature";

// -----------------------------------------------------------------------------
// SCENE SETUP
// -----------------------------------------------------------------------------
export function createScene(canvas: HTMLCanvasElement) {
    const engine = new BABYLON.Engine(canvas, true);

    // Logger config
    BABYLON.Logger.ClearLogCache();
    BABYLON.Logger.LogLevels = BABYLON.Logger.NoneLogLevel;

    const scene = new BABYLON.Scene(engine);
    registerCurvedWorldShaders();

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
    hemisphericLight.intensity = 0.9;

    const directionalLight = new BABYLON.DirectionalLight(
        "dirLight",
        new BABYLON.Vector3(-0.5, -1, 0.5),
        scene
    );

    const shadowGenerator = new BABYLON.ShadowGenerator(2048, directionalLight);
    shadowGenerator.useExponentialShadowMap = true;

    return {
        hemisphericLight,
        directionalLight,
        shadowGenerator,
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
