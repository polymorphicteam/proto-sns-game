// src/components/obstacles/obstaclePatterns.ts
import { ObstacleType } from "./obstacleSystem";

export interface ObstacleDef {
    type: ObstacleType;
    laneIndex: number; // -1 (Left), 0 (Center), 1 (Right)
}

export interface CoinDef {
    laneIndex: number;
    yOffset?: number; // 0 for ground, ~15 for platform, 8 for jump arcs
    count?: number;   // Number of coins in a row
    spacing?: number; // Spacing between coins in a row
}

export interface PatternStep {
    obstacles: ObstacleDef[];
    coins?: CoinDef[];
    delayNext: number; // Time to wait before spawning the NEXT step
}

export type ObstaclePattern = PatternStep[];

// --- CONSTANTS ---
const WALL = "insuperable" as const;
const JUMP = "jump" as const;
const DUCK = "duck" as const;
const PLAT = "platform" as const;

// --- ARCHITECTURES (BURST & BREATHE) ---

// 1. ARCHITECTURE "THE GAUNTLET" (Il Guanto Rotante)
// Structure: 2 Active Steps -> 1 Recovery Step (2.0s)
const PATTERN_GAUNTLET: ObstaclePattern = [
    // [BURST 1]
    // Step 1: Center Jump to Start
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: 0 }],
        coins: [{ laneIndex: 0, count: 3, spacing: 8, yOffset: 8 }], // Arc hint
        delayNext: 1.4 // Allow landing + prepare
    },
    // Step 2: Force Right
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 0 }, { type: DUCK, laneIndex: 1 }],
        coins: [{ laneIndex: 1, count: 3, spacing: 8 }],
        delayNext: 2.0 // RECOVERY TRIGGER
    },
    // [BREATHE]
    // Recovery: Empty lane, coins guiding back to Center for next burst
    {
        obstacles: [],
        coins: [{ laneIndex: 0, count: 5, spacing: 6 }], // Guide to Center
        delayNext: 1.0 // Short setup for next burst
    },

    // [BURST 2]
    // Step 4: Center Jump
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: 0 }],
        coins: [{ laneIndex: 0, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 1.4
    },
    // Step 5: Force Left
    {
        obstacles: [{ type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: -1 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 2.0 // RECOVERY TRIGGER
    }
];

// 2. ARCHITECTURE "FLOOR IS LAVA"
// Strict Rule: Platform (90 units) requires delayNext >= 1.8s for landing.
const PATTERN_LAVA: ObstaclePattern = [
    // [BURST 1]
    // Step 1: Center Platform
    {
        obstacles: [
            { type: PLAT, laneIndex: 0 },
            { type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }
        ],
        // Coins ON platform (y=15)
        coins: [{ laneIndex: 0, yOffset: 15, count: 5, spacing: 10 }],
        delayNext: 2.0 // PLAT_COST (1.8) + Buffer
    },
    // Step 2: Left Platform
    {
        obstacles: [
            { type: PLAT, laneIndex: -1 },
            { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }
        ],
        coins: [{ laneIndex: -1, yOffset: 15, count: 5, spacing: 10 }],
        delayNext: 2.2 // RECOVERY TRIGGER (Longer relax after platforming)
    },

    // [BREATHE] -> Guide to Right
    {
        obstacles: [],
        coins: [{ laneIndex: 1, count: 4, spacing: 8 }],
        delayNext: 1.2
    },

    // [BURST 2]
    // Step 4: Right Platform
    {
        obstacles: [
            { type: PLAT, laneIndex: 1 },
            { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: -1 }
        ],
        coins: [{ laneIndex: 1, yOffset: 15, count: 5, spacing: 10 }],
        delayNext: 2.0
    }
];

// 3. ARCHITECTURE "BROKEN SLALOM"
// Focus: Lane changes guided by coins.
const PATTERN_SLALOM: ObstaclePattern = [
    // [BURST]
    // Step 1: Jump Left
    {
        obstacles: [{ type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: -1 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 1.5 // Jump + Move time
    },
    // Step 2: Jump Center
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: 0 }],
        coins: [{ laneIndex: 0, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 1.5
    },
    // Step 3: Jump Right
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 0 }, { type: JUMP, laneIndex: 1 }],
        coins: [{ laneIndex: 1, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 2.0 // RECOVERY
    },

    // [BREATHE] -> Guide back to Center
    {
        obstacles: [],
        coins: [{ laneIndex: 0, count: 5, spacing: 6 }],
        delayNext: 1.0
    }
];

// 4. ARCHITECTURE "INPUT OVERLOAD" (Chaos Control)
// Reduced density, focusing on alternating actions.
const PATTERN_OVERLOAD: ObstaclePattern = [
    // [BURST 1]
    // Jump Center
    {
        obstacles: [{ type: JUMP, laneIndex: 0 }, { type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }],
        delayNext: 1.4
    },
    // Duck Left
    {
        obstacles: [{ type: DUCK, laneIndex: -1 }, { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }],
        delayNext: 1.4
    },
    // Jump Right
    {
        obstacles: [{ type: JUMP, laneIndex: 1 }, { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: -1 }],
        delayNext: 2.0 // BREATHE
    },

    // [BREATHE]
    {
        obstacles: [],
        coins: [{ laneIndex: 0, count: 4, spacing: 8 }],
        delayNext: 1.0
    }
];

export const PATTERN_CITY = PATTERN_GAUNTLET; // Default reuse
export const PATTERN_NIGHTMARE = PATTERN_LAVA; // Default reuse

export const ALL_PATTERNS = [
    PATTERN_GAUNTLET,
    PATTERN_LAVA,
    PATTERN_SLALOM,
    PATTERN_OVERLOAD
];
