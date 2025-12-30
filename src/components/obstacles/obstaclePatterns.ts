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
export const PATTERN_NIGHTMARE: ObstaclePattern = [
    // --- PHASE 1: WARMUP (Balanced) ---
    {
        obstacles: [{ type: "jump", laneIndex: 0 }],
        coins: [{ laneIndex: -1 }, { laneIndex: 1 }],
        delayNext: 1.6
    },
    {
        obstacles: [{ type: "duck", laneIndex: -1 }],
        coins: [{ laneIndex: 0 }],
        delayNext: 1.6
    },
    {
        obstacles: [{ type: "jump", laneIndex: 1 }],
        coins: [{ laneIndex: -1 }, { laneIndex: 0 }],
        delayNext: 1.6
    },
    {
        obstacles: [{ type: "duck", laneIndex: 0 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8 }, { laneIndex: 1, count: 3, spacing: 8 }],
        delayNext: 1.8
    },

    // --- PHASE 2: THE TUNNEL (Balanced) ---
    // Walls on both sides, obstacles in center
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 1.2 // Increased from 0.4
    },
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "jump", laneIndex: 0 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 1.8 // Increased from 0.6 (Jump needs time)
    },
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "duck", laneIndex: 0 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 1.8 // Increased from 0.6
    },
    // Platform disabled
    // {
    //     obstacles: [
    //         { type: "insuperable", laneIndex: -1 },
    //         { type: "platform", laneIndex: 0 },
    //         { type: "insuperable", laneIndex: 1 }
    //     ],
    //     coins: [{ laneIndex: 0, yOffset: 15, count: 3, spacing: 6 }],
    //     delayNext: 2.2
    // },

    // --- PHASE 3: ZIG-ZAG (Balanced) ---
    { obstacles: [{ type: "insuperable", laneIndex: -1 }], delayNext: 0.9 }, // Increased from 0.4
    { obstacles: [{ type: "insuperable", laneIndex: 0 }], delayNext: 0.9 },
    { obstacles: [{ type: "insuperable", laneIndex: 1 }], delayNext: 0.9 },
    { obstacles: [{ type: "insuperable", laneIndex: 0 }], delayNext: 0.9 },
    { obstacles: [{ type: "insuperable", laneIndex: -1 }], delayNext: 1.5 },

    // --- PHASE 4: THE TRAP (Balanced) ---
    // Center wall, then immediately side walls
    { obstacles: [{ type: "insuperable", laneIndex: 0 }], delayNext: 1.2 }, // Increased from 0.5
    {
        obstacles: [
            { type: "insuperable", laneIndex: -1 },
            { type: "insuperable", laneIndex: 1 }
        ],
        delayNext: 2.5
    },

    // --- PHASE 5: PLATFORM HELL (Disabled) ---
    // {
    //     obstacles: [{ type: "platform", laneIndex: -1 }],
    //     coins: [{ laneIndex: 0, count: 5, spacing: 10 }],
    //     delayNext: 2.2
    // },
    // {
    //     obstacles: [{ type: "platform", laneIndex: 0 }],
    //     delayNext: 2.2
    // },
    // {
    //     obstacles: [{ type: "platform", laneIndex: 1 }],
    //     coins: [{ laneIndex: 1, yOffset: 15, count: 2, spacing: 8 }],
    //     delayNext: 2.2
    // },
    { obstacles: [{ type: "jump", laneIndex: 1 }], delayNext: 1.5 },
];

// CITY PATTERN (EASIER, MORE FLOW)
export const PATTERN_CITY: ObstaclePattern = [
    { obstacles: [{ type: "jump", laneIndex: 0 }], coins: [{ laneIndex: -1, count: 3, spacing: 8 }], delayNext: 2.2 },
    { obstacles: [{ type: "jump", laneIndex: 1 }], coins: [{ laneIndex: 0, count: 3, spacing: 8 }], delayNext: 2.2 },
    { obstacles: [{ type: "jump", laneIndex: -1 }], coins: [{ laneIndex: 1, count: 3, spacing: 8 }], delayNext: 2.2 },

    { obstacles: [{ type: "duck", laneIndex: 0 }], delayNext: 2.2 },
    { obstacles: [{ type: "duck", laneIndex: 1 }], delayNext: 2.2 },
    { obstacles: [{ type: "duck", laneIndex: -1 }], delayNext: 2.2 },

    // Platform disabled
    // {
    //     obstacles: [{ type: "platform", laneIndex: 0 }],
    //     coins: [{ laneIndex: 0, yOffset: 15, count: 5, spacing: 8 }],
    //     delayNext: 3.0
    // },
    // {
    //     obstacles: [{ type: "platform", laneIndex: -1 }, { type: "platform", laneIndex: 1 }],
    //     coins: [{ laneIndex: 0, count: 5, spacing: 8 }],
    //     delayNext: 3.0
    // }
];

// FOOD PATTERN (Uses Burger.glb from jump folder)
export const PATTERN_FOOD: ObstaclePattern = [
    // Burger intro - uses jump type to load Burger.glb
    {
        obstacles: [{ type: "jump", laneIndex: 0 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8 }, { laneIndex: 1, count: 3, spacing: 8 }],
        delayNext: 2.2
    },
    {
        obstacles: [{ type: "jump", laneIndex: -1 }],
        coins: [{ laneIndex: 0, count: 3, spacing: 8 }],
        delayNext: 2.2
    },
    {
        obstacles: [{ type: "jump", laneIndex: 1 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8 }],
        delayNext: 2.2
    },

    // Mixed obstacles
    { obstacles: [{ type: "duck", laneIndex: 0 }], delayNext: 2.0 },
    {
        obstacles: [{ type: "jump", laneIndex: -1 }, { type: "jump", laneIndex: 1 }],
        coins: [{ laneIndex: 0, count: 5, spacing: 8 }],
        delayNext: 2.2
    },

    // Jump over burgers
    {
        obstacles: [{ type: "jump", laneIndex: 0 }],
        delayNext: 1.8
    },
    {
        obstacles: [{ type: "jump", laneIndex: 0 }],
        delayNext: 1.8
    },

    // Burgers on sides
    {
        obstacles: [
            { type: "jump", laneIndex: -1 },
            { type: "jump", laneIndex: 1 }
        ],
        coins: [{ laneIndex: 0, count: 4, spacing: 8 }],
        delayNext: 3.0
    },
];

export const ALL_PATTERNS = [PATTERN_NIGHTMARE, PATTERN_CITY, PATTERN_FOOD];

