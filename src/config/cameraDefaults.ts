// src/config/cameraDefaults.ts
// These are the default camera settings used when no localStorage data exists.
// Update these values to change the default camera view for production builds.
// Press Shift+C in the game to see the current camera values and copy them here.

export const CAMERA_DEFAULTS = {
    alpha: 1.58,         // User's saved alpha
    beta: 0.97,          // User's saved beta
    radius: 83.35,       // User's saved radius
    targetX: 0.0,        // Target X position
    targetY: -7.0,       // Target Y position
    targetZ: 0.0,        // Target Z position
    fov: 1.50,           // Field of View in radians
};
