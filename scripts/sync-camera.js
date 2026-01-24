/**
 * sync-camera.js
 * Pre-build script that syncs camera settings from camera-settings.json to cameraDefaults.ts
 * 
 * Run manually: node scripts/sync-camera.js
 * Runs automatically before build: npm run build
 */

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'camera-settings.json');
const DEFAULTS_FILE = path.join(__dirname, '..', 'src', 'config', 'cameraDefaults.ts');

function main() {
    // Check if camera-settings.json exists
    if (!fs.existsSync(SETTINGS_FILE)) {
        console.log('📷 No camera-settings.json found - using existing defaults');
        return;
    }

    // Read the JSON settings
    let settings;
    try {
        const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
        settings = JSON.parse(content);
        console.log('📷 Found camera-settings.json');
    } catch (err) {
        console.error('❌ Failed to parse camera-settings.json:', err.message);
        process.exit(1);
    }

    // Validate required fields
    const requiredFields = ['alpha', 'beta', 'radius', 'targetX', 'targetY', 'targetZ', 'fov'];
    for (const field of requiredFields) {
        if (typeof settings[field] !== 'number') {
            console.error(`❌ Missing or invalid field: ${field}`);
            process.exit(1);
        }
    }

    // Generate the new cameraDefaults.ts content
    const newContent = `// src/config/cameraDefaults.ts
// These are the default camera settings used when no localStorage data exists.
// Update these values to change the default camera view for production builds.
// Press Shift+C in the game to see the current camera values and copy them here.

export const CAMERA_DEFAULTS = {
    alpha: ${settings.alpha.toFixed(2)},         // From Shift+C save
    beta: ${settings.beta.toFixed(2)},          // From Shift+C save
    radius: ${settings.radius.toFixed(2)},       // From Shift+C save
    targetX: ${settings.targetX.toFixed(1)},       // From Shift+C save
    targetY: ${settings.targetY.toFixed(1)},       // From Shift+C save
    targetZ: ${settings.targetZ.toFixed(1)},       // From Shift+C save
    fov: ${settings.fov.toFixed(2)},           // From Shift+C save (${(settings.fov * 180 / Math.PI).toFixed(1)}°)
};
`;

    // Write the updated file
    try {
        fs.writeFileSync(DEFAULTS_FILE, newContent, 'utf8');
        console.log('✅ Updated cameraDefaults.ts with settings:');
        console.log(`   Alpha: ${settings.alpha.toFixed(2)} rad`);
        console.log(`   Beta: ${settings.beta.toFixed(2)} rad`);
        console.log(`   Radius: ${settings.radius.toFixed(2)}`);
        console.log(`   Target: (${settings.targetX.toFixed(1)}, ${settings.targetY.toFixed(1)}, ${settings.targetZ.toFixed(1)})`);
        console.log(`   FOV: ${settings.fov.toFixed(2)} rad`);
    } catch (err) {
        console.error('❌ Failed to write cameraDefaults.ts:', err.message);
        process.exit(1);
    }
}

main();
