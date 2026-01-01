// src/components/world/fallingCubeRoad.ts
import * as BABYLON from "@babylonjs/core";
import { useGameStore } from "../../store/gameStore";

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    // Grid dimensions - 7 wide × 42 long × 1 segment
    cubesWide: 7,   // 7 * 25 = 175 units wide
    cubesLong: 42,  // 42 * 25 = 1050 units long
    cubeSize: 25,

    // Total road dimensions
    get roadWidth() { return this.cubesWide * this.cubeSize; }, // 175
    get roadLength() { return this.cubesLong * this.cubeSize; }, // 1050

    // Number of road segments
    segmentCount: 3,

    // Falling physics
    fallGravity: 2500, // Very fast gravity (was 800)
    fallMaxSpeed: 4000, // Higher terminal velocity (was 1000)

    // Trigger zone (relative to player Z position)
    triggerZoneStart: -80, // Start checking cubes this far behind player
    triggerZoneEnd: -200,  // Stop checking cubes this far ahead

    // Fall probability per frame when in trigger zone
    fallProbabilityPerSecond: 2.0, // Significantly increased (was 0.6)

    // Maximum adjacent missing cubes (controls gap size)
    maxAdjacentGaps: 1,  // Only single cube holes, no strips

    // Cube appearance
    cubeColor: new BABYLON.Color3(0.15, 0.15, 0.2), // Dark road color
    cubeRoughness: 0.8,
};

// ============================================================
// TYPES
// ============================================================
type CubeState = "active" | "falling" | "fallen";

interface CubeData {
    instance: BABYLON.InstancedMesh;
    state: CubeState;
    fallVelocity: number;
    originalY: number;
    gridX: number;
    gridZ: number;
    segmentIndex: number;
    isCellCenter: boolean; // Only cell centers can fall (center of 3x3 cell)
    randomFallOffset: number; // Randomize when this cube falls behind player
    isSafePath: boolean; // Part of the guaranteed solvable path
}

export interface FallingCubeRoadController {
    // Returns meshes player can collide with (for gap detection)
    getGapBoundingBoxes(): { min: BABYLON.Vector3; max: BABYLON.Vector3 }[];

    // Check if player position is over a gap
    isOverGap(playerX: number, playerZ: number): boolean;

    // Reset all cubes to active state
    reset(): void;

    // Rebuild grid with new target length
    rebuild(targetLength: number): void;

    // Repair gap at specific position (for safe respawn)
    fillGapAt(x: number, z: number): void;

    // Set callback to check for obstacles
    setObstacleChecker(checker: (x: number, z: number, radius: number) => boolean): void;

    // Dispose all resources
    dispose(): void;
}


// ============================================================
// MAIN FACTORY FUNCTION
// ============================================================
export function createFallingCubeRoad(
    scene: BABYLON.Scene,
    shadowGenerator: BABYLON.ShadowGenerator,
    getScrollSpeed: () => number
): FallingCubeRoadController {

    // ----------------------------------------------------------
    // STATE
    // ----------------------------------------------------------
    let cubesLong = CONFIG.cubesLong;
    let roadLength = CONFIG.roadLength;

    let obstacleChecker: ((x: number, z: number, radius: number) => boolean) | null = null;

    // ----------------------------------------------------------
    // CUBE MATERIALS - Checkerboard pattern
    // ----------------------------------------------------------
    // ----------------------------------------------------------
    // CUBE MATERIALS - Checkerboard pattern (Gray Asphalt)
    // ----------------------------------------------------------
    // ----------------------------------------------------------
    // CUBE MATERIALS - Uniform Gray (Asphalt)
    // ----------------------------------------------------------
    const redMaterial = new BABYLON.PBRMaterial("cubeMatRed", scene);
    // Uniform Asphalt Color
    redMaterial.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    redMaterial.roughness = 0.9;
    redMaterial.metallic = 0.0;

    const blackMaterial = new BABYLON.PBRMaterial("cubeMatBlack", scene);
    // Same Uniform Asphalt Color (No visible pattern)
    blackMaterial.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    blackMaterial.roughness = 0.9;
    blackMaterial.metallic = 0.0;

    // ----------------------------------------------------------
    // SOURCE CUBE MESHES (for instancing) - one per color
    // ----------------------------------------------------------
    const sourceCubeRed = BABYLON.MeshBuilder.CreateBox(
        "fallingCubeSourceRed",
        { size: CONFIG.cubeSize },
        scene
    );
    sourceCubeRed.material = redMaterial;
    sourceCubeRed.isVisible = false;
    sourceCubeRed.receiveShadows = true;

    const sourceCubeBlack = BABYLON.MeshBuilder.CreateBox(
        "fallingCubeSourceBlack",
        { size: CONFIG.cubeSize },
        scene
    );
    sourceCubeBlack.material = blackMaterial;
    sourceCubeBlack.isVisible = false;
    sourceCubeBlack.receiveShadows = true;

    // ----------------------------------------------------------
    // CUBE DATA
    // ----------------------------------------------------------
    const allCubes: CubeData[] = [];
    const fallenCubePositions: Map<string, { x: number; z: number }> = new Map();

    function getCubeKey(cube: CubeData): string {
        return `${cube.segmentIndex}_${cube.gridX}_${cube.gridZ}`;
    }

    // Helper to check if a cube is the center of a 3x3 cell
    function isCellCenter(gx: number, gz: number): boolean {
        return (gx % 3 === 1) && (gz % 3 === 1);
    }

    // ----------------------------------------------------------
    // GENERATE GRID
    // ----------------------------------------------------------
    function generateGrid() {
        // Clear existing
        for (const cube of allCubes) {
            cube.instance.dispose();
        }
        allCubes.length = 0;
        fallenCubePositions.clear();

        // Calculate starting positions to center the road
        const startX = -CONFIG.roadWidth / 2 + CONFIG.cubeSize / 2;
        const cubeY = -CONFIG.cubeSize / 2; // Top of cube at Y=0 (ground level)

        let cellCenterCount = 0;

        for (let seg = 0; seg < CONFIG.segmentCount; seg++) {
            const segmentStartZ = -seg * roadLength;

            for (let gx = 0; gx < CONFIG.cubesWide; gx++) {
                for (let gz = 0; gz < cubesLong; gz++) {
                    const x = startX + gx * CONFIG.cubeSize;
                    // Position cubes to tile from segmentStartZ going backward (negative Z)
                    // First cube center at segmentStartZ - halfCube, last at segmentStartZ - roadLength + halfCube
                    const z = segmentStartZ - (gz * CONFIG.cubeSize) - (CONFIG.cubeSize / 2);

                    // Checkerboard pattern: use red or black based on position
                    const isRedSquare = (gx + gz + seg) % 2 === 0;
                    const sourceCube = isRedSquare ? sourceCubeRed : sourceCubeBlack;

                    const instance = sourceCube.createInstance(`cube_${seg}_${gx}_${gz}`);
                    instance.position = new BABYLON.Vector3(x, cubeY, z);
                    instance.receiveShadows = true;

                    // Add to shadow caster
                    shadowGenerator.addShadowCaster(instance, true);

                    const isCenter = isCellCenter(gx, gz);
                    if (isCenter) cellCenterCount++;

                    allCubes.push({
                        instance,
                        state: "active",
                        fallVelocity: 0,
                        originalY: cubeY,
                        gridX: gx,
                        gridZ: gz,
                        segmentIndex: seg,
                        isCellCenter: isCenter,
                        randomFallOffset: Math.random() * 100, // Random delay for falling
                        isSafePath: false,
                    });
                }
            }
        }

        // Generate guaranteed solvable path
        generateSafePath();

        console.log(`✅ Created falling cube road: ${allCubes.length} cubes, ${cellCenterCount} cell centers that can fall`);
    }

    // ----------------------------------------------------------
    // PATH WEAVER ALGORITHM
    // ----------------------------------------------------------
    function generateSafePath() {
        console.log("🕸️ Weaving safe path...");

        // Map cubes for easy lookup: "seg_z" -> Map<x, CubeData>
        // We only care about columns 1-5 (Center lanes). 0 and 6 are always safe.
        const rowMap = new Map<string, Map<number, CubeData>>();

        for (const cube of allCubes) {
            const key = `${cube.segmentIndex}_${cube.gridZ}`;
            if (!rowMap.has(key)) rowMap.set(key, new Map());
            rowMap.get(key)!.set(cube.gridX, cube);
        }

        // Start at center lane (Index 3 for width 7)
        let currentLane = 3;

        for (let seg = 0; seg < CONFIG.segmentCount; seg++) {
            for (let z = 0; z < cubesLong; z++) {
                const key = `${seg}_${z}`;
                const row = rowMap.get(key);
                if (!row) continue;

                // Mark current lane as safe
                const safeCube = row.get(currentLane);
                if (safeCube) {
                    safeCube.isSafePath = true;
                }

                // Decide next lane (Random Walk: -1, 0, +1)
                const dir = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
                let nextLane = currentLane + dir;

                // Clamp to inner lanes (1-5)
                if (nextLane < 1) nextLane = 1;
                if (nextLane > 5) nextLane = 5;

                currentLane = nextLane;
            }
        }
    }

    // Initial generation
    generateGrid();

    // ----------------------------------------------------------
    // REBUILD
    // ----------------------------------------------------------
    function rebuild(targetLength: number) {
        console.log(`🛠️ Rebuilding road with target length: ${targetLength}`);

        // Calculate new cubesLong (round to nearest cube)
        cubesLong = Math.round(targetLength / CONFIG.cubeSize);
        roadLength = cubesLong * CONFIG.cubeSize;

        console.log(`   -> New dimensions: ${cubesLong} cubes long = ${roadLength} units`);

        generateGrid();
    }

    // ----------------------------------------------------------
    // GAME STATE LISTENER - Reset cubes when player dies
    // ----------------------------------------------------------
    let previousLives = useGameStore.getState().lives;
    const unsubscribe = useGameStore.subscribe((state) => {
        // Reset road when player loses a life?
        // User requested: "Don't reset the cubes... only at the end of each segment"
        // so we REMOVE the auto-reset on death.
        /*
        if (state.lives < previousLives) {
            console.log("💔 Player lost life - resetting cube road");
            reset();
        }
        */
        previousLives = state.lives;
    });

    // ----------------------------------------------------------
    // UPDATE LOOP
    // ----------------------------------------------------------
    const updateObserver = scene.onBeforeRenderObservable.add(() => {
        const gameState = useGameStore.getState().gameState;
        if (gameState !== "playing") return;

        const speed = getScrollSpeed();
        if (speed === 0) return;

        const dt = scene.getEngine().getDeltaTime() / 1000;
        const movement = speed * dt;

        // Player is always at Z=0 in this game (world scrolls toward them)
        const playerZ = 0;

        // Total road length (all segments combined)
        const totalRoadLength = CONFIG.segmentCount * roadLength;

        // Find the furthest back cube Z for looping reference
        let minCubeZ = Infinity;
        for (const cube of allCubes) {
            if (cube.instance.position.z < minCubeZ) {
                minCubeZ = cube.instance.position.z;
            }
        }

        // Process each cube
        for (const cube of allCubes) {
            // ----------------------------------------------------------
            // 1) MOVE WITH SCROLL
            // ----------------------------------------------------------
            cube.instance.position.z += movement;

            // ----------------------------------------------------------
            // 2) SEGMENT LOOPING & REAR FALLING
            // ----------------------------------------------------------

            // Thresholds
            const rearFallZ = CONFIG.cubeSize * 1.5; // Start falling closer to player
            // Limit to ~3 rows falling behind the player before recycling
            // rearFallZ (1.5) + 3 rows (3.0) = 4.5
            const recycleZ = CONFIG.cubeSize * 4.5;

            // A) Trigger Fall Behind Player
            // Add random offset so they don't fall in perfect rows
            const triggerZ = rearFallZ + (cube.randomFallOffset || 0);

            if (cube.instance.position.z > triggerZ && cube.state === "active") {
                cube.state = "falling";
            }

            // B) Loop when very far behind
            if (cube.instance.position.z > recycleZ) {
                // Wrap to the back of the road
                cube.instance.position.z -= totalRoadLength;

                // Reset cube state when it loops
                if (cube.state !== "active") {
                    cube.state = "active";
                    cube.fallVelocity = 0;
                    cube.instance.position.y = cube.originalY;
                    cube.instance.isVisible = true;
                    fallenCubePositions.delete(getCubeKey(cube));
                }
            }

            // ----------------------------------------------------------
            // 3) FALLING LOGIC
            // ----------------------------------------------------------
            if (cube.state === "falling") {
                // Apply gravity
                cube.fallVelocity = Math.min(
                    cube.fallVelocity + CONFIG.fallGravity * dt,
                    CONFIG.fallMaxSpeed
                );
                cube.instance.position.y -= cube.fallVelocity * dt;

                // Check if fallen far enough to become a gap
                // BUT: If it's a rear-falling cube (z > rearFallZ), keep it visible!
                const isRearCube = cube.instance.position.z > rearFallZ;

                if (!isRearCube && cube.instance.position.y < cube.originalY - CONFIG.cubeSize * 3) {
                    cube.state = "fallen";
                    cube.instance.isVisible = false;

                    // Record gap position for collision detection
                    fallenCubePositions.set(getCubeKey(cube), {
                        x: cube.instance.position.x,
                        z: cube.instance.position.z,
                    });
                }
            }

            // ----------------------------------------------------------
            // 4) TRIGGER FALLING (random chance in trigger zone)
            // ----------------------------------------------------------
            if (cube.state === "active") {
                const cubeZ = cube.instance.position.z;

                // Check if cube is in trigger zone
                if (cubeZ > CONFIG.triggerZoneEnd && cubeZ < CONFIG.triggerZoneStart) {
                    // Random chance to fall
                    // DIFFICULTY SCALING: Increase probability over time
                    // Start at 1.0, increase by 0.1 every 10 seconds, cap at 5.0
                    const timeSinceStart = performance.now() / 1000;
                    const difficultyMult = Math.min(5.0, 1.0 + (timeSinceStart / 20)); // Slower ramp up

                    const fallChance = CONFIG.fallProbabilityPerSecond * difficultyMult * dt;
                    if (Math.random() < fallChance) {
                        // Check safe path constraint
                        if (canCubeFall(cube)) {
                            cube.state = "falling";
                            cube.fallVelocity = 0;
                        }
                    }
                }
            }
        }
    });

    // ----------------------------------------------------------
    // CELL HOLE CHECK - Only cell centers can fall
    // ----------------------------------------------------------
    function canCubeFall(cube: CubeData): boolean {
        // 1. Never outside lanes (exclude 0 and 6)
        // Allow columns 1, 2, 3, 4, 5 (Center 5)
        if (cube.gridX < 1 || cube.gridX > 5) {
            return false;
        }

        // 1.5 Guaranteed Safe Path (Path Weaver)
        if (cube.isSafePath) return false;

        // 1.6 OBSTACLE CHECK - Do not fall if there is an obstacle above!
        // User requested: "Never allow any holes to be under or in front of or behind an obstacle"
        // Increased radius to 40 (approx 2 cubes, +/- 50 units) to cover front/back/under
        if (obstacleChecker) {
            if (obstacleChecker(cube.instance.position.x, cube.instance.position.z, 40)) {
                return false;
            }
        }

        // 2. Enforce Z spacing (every 3 units) - Keeps rows clean
        if (cube.gridZ % 3 !== 0) {
            return false;
        }

        // 3. MAX 2 HOLES PER ROW
        // Count how many cubes in this row (same gridZ, same segment) have already fallen.
        // If 2 or more, don't allow another hole.
        let holesInRow = 0;
        for (const other of allCubes) {
            if (other.gridZ === cube.gridZ && other.segmentIndex === cube.segmentIndex) {
                if (other.state === "falling" || other.state === "fallen") {
                    holesInRow++;
                }
            }
        }
        if (holesInRow >= 2) {
            return false;
        }

        return true;
    }

    // ----------------------------------------------------------
    // GAP DETECTION FOR PLAYER
    // ----------------------------------------------------------
    function isOverGap(playerX: number, playerZ: number): boolean {
        // Increase tolerance slightly to "guarantee" fall if they are mostly over the hole
        // Cube size 25 -> Half 12.5.
        // User requested: "Only triggered when closer to the center."
        // Reducing radius to 8 (so you must be within 8 units of center)
        const searchRadius = 8;

        for (const cube of allCubes) {
            if (cube.state === "fallen") {
                // Use the LIVE instance position, not a stored snapshot
                const dx = Math.abs(playerX - cube.instance.position.x);
                const dz = Math.abs(playerZ - cube.instance.position.z);

                if (dx < searchRadius && dz < searchRadius) {
                    return true;
                }
            }
        }
        return false;
    }

    function getGapBoundingBoxes(): { min: BABYLON.Vector3; max: BABYLON.Vector3 }[] {
        const boxes: { min: BABYLON.Vector3; max: BABYLON.Vector3 }[] = [];
        const halfCube = CONFIG.cubeSize / 2;

        for (const [, pos] of fallenCubePositions) {
            boxes.push({
                min: new BABYLON.Vector3(pos.x - halfCube, -100, pos.z - halfCube),
                max: new BABYLON.Vector3(pos.x + halfCube, 0, pos.z + halfCube),
            });
        }

        return boxes;
    }

    // ----------------------------------------------------------
    // RESET
    // ----------------------------------------------------------
    function reset() {
        for (const cube of allCubes) {
            cube.state = "active";
            cube.fallVelocity = 0;
            cube.instance.position.y = cube.originalY;
            cube.instance.isVisible = true;
        }
        fallenCubePositions.clear();
        console.log("🔄 Falling cube road reset");
    }

    // ----------------------------------------------------------
    // REPAIR ROAD (fill gap at position)
    // ----------------------------------------------------------
    function fillGapAt(x: number, z: number): void {
        const searchRadius = CONFIG.cubeSize; // 25

        for (const cube of allCubes) {
            // Find closest fallen cube
            if (cube.state === "fallen") {
                const dx = Math.abs(x - cube.instance.position.x);
                const dz = Math.abs(z - cube.instance.position.z);

                if (dx < searchRadius && dz < searchRadius) {
                    // Restore this cube
                    console.log("🩹 Repairing road gap under player");
                    cube.state = "active";
                    cube.fallVelocity = 0;
                    cube.instance.position.y = cube.originalY;
                    cube.instance.isVisible = true;
                    // Remove from fallen tracking
                    fallenCubePositions.delete(getCubeKey(cube));
                    // We can stop after fixing one, or fix all in radius. Fixing one is usually enough.
                    return;
                }
            }
        }
    }

    // ----------------------------------------------------------
    // DISPOSE
    // ----------------------------------------------------------
    function dispose() {
        scene.onBeforeRenderObservable.remove(updateObserver);
        unsubscribe(); // Remove game state listener

        for (const cube of allCubes) {
            cube.instance.dispose();
        }
        allCubes.length = 0;

        sourceCubeRed.dispose();
        sourceCubeBlack.dispose();
        redMaterial.dispose();
        blackMaterial.dispose();
        fallenCubePositions.clear();

        console.log("🗑️ Falling cube road disposed");
    }

    // ----------------------------------------------------------
    // RETURN CONTROLLER
    // ----------------------------------------------------------
    return {
        getGapBoundingBoxes,
        isOverGap,
        reset,
        rebuild,
        fillGapAt, // <--- New API
        setObstacleChecker: (checker) => { obstacleChecker = checker; },
        dispose,
    };
}
