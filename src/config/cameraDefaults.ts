// src/config/cameraDefaults.ts
// These are the default camera settings used when no localStorage data exists.
// Update these values to change the default camera view for production builds.
// Press Shift+C in the game to see the current camera values and copy them here.

export const CAMERA_DEFAULTS = {
    alpha: 1.56,         // User's saved alpha
    beta: 0.90,          // User's saved beta
    radius: 50.04,       // User's saved radius
    targetX: 0.5,        // Target X position
    targetY: -0.2,       // Target Y position
    targetZ: -6.2,       // Target Z position
    fov: 1.50,           // Field of View in radians
};
