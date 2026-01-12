// src/components/obstacles/obstaclePatterns.ts
import { ObstacleType } from "./obstacleSystem";

export interface ObstacleDef {
    type: ObstacleType;
    laneIndex: number;
}

export interface CoinDef {
    laneIndex: number;
    yOffset?: number;
    count?: number;
    spacing?: number;
}

export interface PatternStep {
    obstacles: ObstacleDef[];
    coins?: CoinDef[];
    delayNext: number;
}

export type ObstaclePattern = PatternStep[];

const WALL = "insuperable" as const;
const JUMP = "jump" as const;
const DUCK = "duck" as const;
const PLAT = "platform" as const;

// 1. ARCHITECTURE "THE GAUNTLET" (Burst & Breathe)
// Aggressività aumentata: 0.9s tra i salti centrali
const PATTERN_GAUNTLET: ObstaclePattern = [
    // [BURST]
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: 0 }],
        coins: [{ laneIndex: 0, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 0.9 // MOLTO VICINO (Burst)
    },
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: 0 }],
        coins: [{ laneIndex: 0, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 1.1 // Un po' di respiro
    },
    // Switch violento a Destra
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 0 }, { type: DUCK, laneIndex: 1 }],
        coins: [{ laneIndex: 1, count: 3, spacing: 8 }],
        delayNext: 2.0 // RECOVERY
    },
    // [BREATHE]
    {
        obstacles: [],
        coins: [{ laneIndex: 0, count: 6, spacing: 8 }],
        delayNext: 1.0
    },
    // [BURST 2]
    {
        obstacles: [{ type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: -1 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 0.9 // Burst
    },
    {
        obstacles: [{ type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }, { type: DUCK, laneIndex: -1 }],
        delayNext: 2.2 // RECOVERY
    }
];

// 2. ARCHITECTURE "FLOOR IS LAVA"
const PATTERN_LAVA: ObstaclePattern = [
    // Center Platform
    {
        obstacles: [{ type: PLAT, laneIndex: 0 }, { type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }],
        coins: [{ laneIndex: 0, yOffset: 15, count: 5, spacing: 10 }],
        delayNext: 1.9 // Deve essere quasi 1.8 (Plat Cost)
    },
    // Left Platform (Chain)
    {
        obstacles: [{ type: PLAT, laneIndex: -1 }, { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }],
        coins: [{ laneIndex: -1, yOffset: 15, count: 5, spacing: 10 }],
        delayNext: 2.2 // RECOVERY
    },
    // [BREATHE] -> Guide Right
    {
        obstacles: [],
        coins: [{ laneIndex: 1, count: 4, spacing: 8 }],
        delayNext: 1.2
    },
    // Right Platform
    {
        obstacles: [{ type: PLAT, laneIndex: 1 }, { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: -1 }],
        coins: [{ laneIndex: 1, yOffset: 15, count: 5, spacing: 10 }],
        delayNext: 2.0
    }
];

// 3. ARCHITECTURE "BROKEN SLALOM"
// Qui vogliamo ritmo.
const PATTERN_SLALOM: ObstaclePattern = [
    // Left Jump
    {
        obstacles: [{ type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: -1 }],
        coins: [{ laneIndex: -1, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 1.3 // Tempo per spostarsi al centro
    },
    // Center Jump
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }, { type: JUMP, laneIndex: 0 }],
        coins: [{ laneIndex: 0, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 1.3 // Tempo per spostarsi a destra
    },
    // Right Jump
    {
        obstacles: [{ type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 0 }, { type: JUMP, laneIndex: 1 }],
        coins: [{ laneIndex: 1, count: 3, spacing: 8, yOffset: 8 }],
        delayNext: 2.0 // RECOVERY
    },
    // [BREATHE]
    {
        obstacles: [],
        coins: [{ laneIndex: 0, count: 5, spacing: 6 }],
        delayNext: 1.0
    }
];

// 4. ARCHITECTURE "INPUT OVERLOAD" (High Speed)
const PATTERN_OVERLOAD: ObstaclePattern = [
    // Center Jump
    {
        obstacles: [{ type: JUMP, laneIndex: 0 }, { type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }],
        delayNext: 0.9 // Burst
    },
    // Center Duck (Same Lane = Fast)
    {
        obstacles: [{ type: DUCK, laneIndex: 0 }, { type: WALL, laneIndex: -1 }, { type: WALL, laneIndex: 1 }],
        delayNext: 1.0
    },
    // Forced Lane Switch Left
    {
        obstacles: [{ type: JUMP, laneIndex: -1 }, { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: 1 }],
        delayNext: 2.0 // RECOVERY (Lane switch richiede tempo)
    },
    // [BREATHE]
    {
        obstacles: [],
        coins: [{ laneIndex: 1, count: 4, spacing: 8 }],
        delayNext: 1.0
    },
    // Right Duck
    {
        obstacles: [{ type: DUCK, laneIndex: 1 }, { type: WALL, laneIndex: 0 }, { type: WALL, laneIndex: -1 }],
        delayNext: 2.0
    }
];

export const PATTERN_CITY = PATTERN_GAUNTLET;
export const PATTERN_NIGHTMARE = PATTERN_LAVA;

export const ALL_PATTERNS = [
    PATTERN_GAUNTLET,
    PATTERN_LAVA,
    PATTERN_SLALOM,
    PATTERN_OVERLOAD
];