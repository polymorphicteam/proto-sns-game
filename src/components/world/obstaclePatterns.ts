import { ObstacleType } from "./obstacleSystem";

export interface PatternStep {
    type: ObstacleType;
    laneIndex: number; // -1 (Left), 0 (Center), 1 (Right)
    delayNext: number; // Time to wait before spawning the NEXT obstacle
}

export type ObstaclePattern = PatternStep[];

// Simple test pattern:
// 1. Jump obstacle in center
// 2. Duck obstacle in left
// 3. Insuperable obstacle in right
// 4. Platform in center
export const TEST_PATTERN: ObstaclePattern = [
    { type: "jump", laneIndex: 0, delayNext: 1.5 },
    { type: "duck", laneIndex: -1, delayNext: 1.5 },
    { type: "insuperable", laneIndex: 1, delayNext: 2.0 },
    { type: "platform", laneIndex: 0, delayNext: 2.5 },
    { type: "insuperable", laneIndex: 0, delayNext: 1.5 },
    { type: "jump", laneIndex: 1, delayNext: 1.5 },
    { type: "duck", laneIndex: -1, delayNext: 2.0 },
];
