import { ObstacleType } from "./obstacleSystem";

export interface ObstacleDef {
    type: ObstacleType;
    laneIndex: number; // -1 (Left), 0 (Center), 1 (Right)
}

export interface CoinDef {
    laneIndex: number;
    yOffset?: number; // 0 for ground, ~15 for platform
    count?: number;   // Number of coins in a row
    spacing?: number; // Spacing between coins in a row
}

export interface PatternStep {
    obstacles: ObstacleDef[];
    coins?: CoinDef[];
    delayNext: number; // Time to wait before spawning the NEXT step
}

export type ObstaclePattern = PatternStep[];

// NIGHTMARE PATTERN (BALANCED + COINS)
export const TEST_PATTERN: ObstaclePattern = [
    // --- PHASE 1: WARMUP (Balanced) ---
    {
        obstacles: [{ type: "jump", laneIndex: 0 }],
        coins: [{ laneIndex: -1 }, { laneIndex: 1 }],
        delayNext: 1.1
    },
    {
        obstacles: [{ type: "duck", laneIndex: -1 }],
        coins: [{ laneIndex: 0 }],
        delayNext: 1.1
    },
    {
        obstacles: [{ type: "jump", laneIndex: 1 }],
        coins: [{ laneIndex: -1 }, { laneIndex: 0 }],
        delayNext: 1.1
    },
    {
        obstacles: [{ type: "duck", laneIndex: 0 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8 }, { laneIndex: 1, count: 3, spacing: 8 }],
        delayNext: 1.2
    },

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
        coins: [{ laneIndex: 0, yOffset: 15, count: 3, spacing: 6 }], // Row on platform
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
    {
        obstacles: [{ type: "platform", laneIndex: -1 }],
        coins: [{ laneIndex: 0, count: 5, spacing: 10 }], // Coins in center lane (safe)
        delayNext: 1.5
    },
    {
        obstacles: [{ type: "platform", laneIndex: 0 }],
        // No coins here, just survive
        delayNext: 1.5
    },
    {
        obstacles: [{ type: "platform", laneIndex: 1 }],
        coins: [{ laneIndex: 1, yOffset: 15, count: 2, spacing: 8 }], // Short row on platform
        delayNext: 1.5
    },
    { obstacles: [{ type: "jump", laneIndex: 1 }], delayNext: 1.0 },
];
