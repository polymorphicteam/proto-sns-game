// src/config/cameraDefaults.ts
// These are the default camera settings used when no localStorage data exists.
// Update these values to change the default camera view for production builds.
// Press Shift+C in the game to see the current camera values and copy them here.

export const CAMERA_DEFAULTS = {
    alpha: 1.57,         // PI/2 for side view
    beta: 1.0,           // Slightly downward angle
    radius: 85,          // Zoomed out for better visibility
    targetX: 0.0,        // Centered on road
    targetY: -15,        // Match player camera offset
    targetZ: 0.0,        // At player position
    fov: 2.00,           // Field of View in radians (≈ 115°)
};
