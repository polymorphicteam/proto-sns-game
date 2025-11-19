import { ObstacleType } from "./obstacleSystem";

export interface ObstacleDef {
    type: ObstacleType;
    laneIndex: number; // -1 (Left), 0 (Center), 1 (Right)
}

export interface PatternStep {
    obstacles: ObstacleDef[];
    delayNext: number; // Time to wait before spawning the NEXT step
}

export type ObstaclePattern = PatternStep[];

// NIGHTMARE PATTERN (BALANCED)
export const TEST_PATTERN: ObstaclePattern = [
    // --- PHASE 1: WARMUP (Balanced) ---
    { obstacles: [{ type: "jump", laneIndex: 0 }], delayNext: 1.1 },
    { obstacles: [{ type: "duck", laneIndex: -1 }], delayNext: 1.1 },
    { obstacles: [{ type: "jump", laneIndex: 1 }], delayNext: 1.1 },
    { obstacles: [{ type: "duck", laneIndex: 0 }], delayNext: 1.2 },

    // --- PHASE 2: THE TUNNEL (Balanced) ---
    // Walls on both sides, obstacles in center
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 0.8 // Increased from 0.4
    },
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "jump", laneIndex: 0 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 1.2 // Increased from 0.6 (Jump needs time)
    },
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "duck", laneIndex: 0 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 1.2 // Increased from 0.6
    },
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "platform", laneIndex: 0 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 1.5 // Increased from 1.0
    },

    // --- PHASE 3: ZIG-ZAG (Balanced) ---
    { obstacles: [{ type: "insuperable", laneIndex: -1 }], delayNext: 0.6 }, // Increased from 0.4
    { obstacles: [{ type: "insuperable", laneIndex: 0 }], delayNext: 0.6 },
    { obstacles: [{ type: "insuperable", laneIndex: 1 }], delayNext: 0.6 },
    { obstacles: [{ type: "insuperable", laneIndex: 0 }], delayNext: 0.6 },
    { obstacles: [{ type: "insuperable", laneIndex: -1 }], delayNext: 1.0 },

    // --- PHASE 4: THE TRAP (Balanced) ---
    // Center wall, then immediately side walls
    { obstacles: [{ type: "insuperable", laneIndex: 0 }], delayNext: 0.8 }, // Increased from 0.5
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 1.8
    },

    // --- PHASE 5: PLATFORM HELL (Balanced) ---
    { obstacles: [{ type: "platform", laneIndex: -1 }], delayNext: 1.5 },
    { obstacles: [{ type: "platform", laneIndex: 0 }], delayNext: 1.5 },
    { obstacles: [{ type: "platform", laneIndex: 1 }], delayNext: 1.5 },
    { obstacles: [{ type: "jump", laneIndex: 1 }], delayNext: 1.0 },
];
