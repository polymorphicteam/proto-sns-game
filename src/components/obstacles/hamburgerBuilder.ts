// src/components/obstacles/hamburgerBuilder.ts
import * as BABYLON from "@babylonjs/core";
import { getHamburgerUnifiedMaterial } from "../materials/MaterialFactory";

/**
 * Applies a single color to all vertices of a mesh
 */
function applyVertexColor(mesh: BABYLON.Mesh, color: number[]): void {
    const count = mesh.getTotalVertices();
    if (count === 0) return;

    const colors: number[] = [];
    for (let i = 0; i < count; i++) {
        colors.push(color[0], color[1], color[2], color[3]);
    }

    mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
}

/**
 * Creates a 3D hamburger mesh using Babylon.js primitives
 * Perfect as a jump obstacle!
 */
export function buildHamburgerObstacle(
    scene: BABYLON.Scene,
    scale: number = 0.75  // Default 25% smaller
): BABYLON.Mesh {
    // Parent mesh to hold all parts
    const hamburger = new BABYLON.Mesh("obs_hamburger", scene);

    // ============================================
    // PALETTE
    // ============================================
    // RGBA colors for vertex coloring
    const cBun = [0.95, 0.70, 0.30, 1];
    const cPatty = [0.40, 0.20, 0.10, 1];
    const cCheese = [1.00, 0.90, 0.20, 1];
    const cLettuce = [0.20, 0.80, 0.20, 1];
    const cTomato = [1.00, 0.20, 0.20, 1];
    const cSesame = [0.98, 0.96, 0.90, 1];

    // ============================================
    // DIMENSIONS (scaled)
    // ============================================
    const bunRadius = 6 * scale;
    const bunHeight = 3 * scale;
    const pattyRadius = 5.5 * scale;
    const pattyHeight = 1.5 * scale;

    let yOffset = 0;

    // ============================================
    // BOTTOM BUN (cylinder with rounded-ish look)
    // ============================================
    const bottomBun = BABYLON.MeshBuilder.CreateCylinder(
        "bottomBun",
        {
            diameter: bunRadius * 2,
            height: bunHeight,
            tessellation: 32
        },
        scene
    );
    applyVertexColor(bottomBun, cBun);

    yOffset = bunHeight / 2;
    bottomBun.position.y = yOffset;
    bottomBun.parent = hamburger;

    yOffset += bunHeight / 2;

    // ============================================
    // PATTY
    // ============================================
    const patty = BABYLON.MeshBuilder.CreateCylinder(
        "patty",
        {
            diameter: pattyRadius * 2,
            height: pattyHeight,
            tessellation: 32
        },
        scene
    );
    applyVertexColor(patty, cPatty);

    yOffset += pattyHeight / 2;
    patty.position.y = yOffset;
    patty.parent = hamburger;
    yOffset += pattyHeight / 2;

    // ============================================
    // CHEESE (slightly tilted disc, drooping)
    // ============================================
    const cheeseSize = bunRadius * 1.8;
    const cheese = BABYLON.MeshBuilder.CreateBox(
        "cheese",
        {
            width: cheeseSize,
            height: 0.3 * scale,
            depth: cheeseSize
        },
        scene
    );
    applyVertexColor(cheese, cCheese);

    yOffset += 0.15 * scale;
    cheese.position.y = yOffset;
    cheese.rotation.y = Math.PI / 4; // Diamond orientation
    cheese.parent = hamburger;
    yOffset += 0.15 * scale;

    // ============================================
    // LETTUCE (wavy disc using multiple boxes)
    // ============================================
    const lettuceRadius = bunRadius * 1.1;
    const lettuceHeight = 0.8 * scale;
    yOffset += lettuceHeight / 2;

    for (let i = 0; i < 6; i++) {
        const leaf = BABYLON.MeshBuilder.CreateBox(
            `lettuce_${i}`,
            {
                width: lettuceRadius * 0.8,
                height: lettuceHeight,
                depth: lettuceRadius * 0.5
            },
            scene
        );
        applyVertexColor(leaf, cLettuce);

        leaf.position.y = yOffset;
        leaf.rotation.y = (Math.PI / 3) * i;
        leaf.position.x = Math.cos((Math.PI / 3) * i) * bunRadius * 0.3;
        leaf.position.z = Math.sin((Math.PI / 3) * i) * bunRadius * 0.3;
        leaf.parent = hamburger;
    }
    yOffset += lettuceHeight / 2;

    // ============================================
    // TOMATO SLICES
    // ============================================
    const tomatoRadius = 4 * scale;
    const tomatoHeight = 0.6 * scale;
    yOffset += tomatoHeight / 2;

    const tomato1 = BABYLON.MeshBuilder.CreateCylinder(
        "tomato1",
        { diameter: tomatoRadius * 2, height: tomatoHeight, tessellation: 16 },
        scene
    );
    applyVertexColor(tomato1, cTomato);

    tomato1.position.y = yOffset;
    tomato1.position.x = -1.5 * scale;
    tomato1.parent = hamburger;

    const tomato2 = BABYLON.MeshBuilder.CreateCylinder(
        "tomato2",
        { diameter: tomatoRadius * 2, height: tomatoHeight, tessellation: 16 },
        scene
    );
    applyVertexColor(tomato2, cTomato);

    tomato2.position.y = yOffset;
    tomato2.position.x = 1.5 * scale;
    tomato2.parent = hamburger;

    yOffset += tomatoHeight / 2;

    // ============================================
    // TOP BUN (dome-shaped using hemisphere)
    // ============================================
    const topBunHeight = bunHeight * 1.2;
    const topBun = BABYLON.MeshBuilder.CreateSphere(
        "topBun",
        {
            diameter: bunRadius * 2,
            slice: 0.5, // Half sphere
            segments: 16
        },
        scene
    );
    applyVertexColor(topBun, cBun);

    // Position top bun right on top of tomatoes (no gap)
    topBun.position.y = yOffset;
    topBun.parent = hamburger;

    // ============================================
    // SESAME SEEDS on top bun
    // ============================================
    const seedPositions = [
        { x: 0, z: -2 },
        { x: 1.5, z: -1 },
        { x: -1.5, z: -1 },
        { x: 2, z: 1 },
        { x: -2, z: 1 },
        { x: 0, z: 2 },
        { x: 1, z: 0.5 },
        { x: -1, z: 0.5 },
    ];

    seedPositions.forEach((pos, i) => {
        const seed = BABYLON.MeshBuilder.CreateCapsule(
            `seed_${i}`,
            {
                height: 0.8 * scale,
                radius: 0.2 * scale
            },
            scene
        );
        applyVertexColor(seed, cSesame);

        // Position on the dome surface
        const seedX = pos.x * scale;
        const seedZ = pos.z * scale;
        const distFromCenter = Math.sqrt(seedX * seedX + seedZ * seedZ);
        const seedY = yOffset + Math.sqrt(Math.max(0, bunRadius * bunRadius - distFromCenter * distFromCenter)) * 0.7;
        seed.position.set(seedX, seedY, seedZ);
        seed.rotation.x = Math.PI / 2; // Lay flat
        seed.rotation.z = Math.random() * Math.PI; // Random rotation
        seed.parent = hamburger;
    });

    // ============================================
    // POSITION THE WHOLE HAMBURGER
    // ============================================
    // Raise it so the base sits at y = 0
    const totalHeight = yOffset + bunRadius;
    hamburger.position.y = 0; // Base at ground level

    // Merge all children into a single mesh for better performance
    const allChildren = hamburger.getChildMeshes() as BABYLON.Mesh[];
    if (allChildren.length > 0) {
        const merged = BABYLON.Mesh.MergeMeshes(
            allChildren,
            true,  // Dispose source
            false,  // Allow different materials (FALSE -> Single Material)
            hamburger, // Parent
            false, // Don't subdivide
            true   // Multi-material (FALSE -> Single SubMesh)
        );
        if (merged) {
            merged.name = "obs_hamburger";
            merged.material = getHamburgerUnifiedMaterial(scene);
            merged.useVertexColors = true;
            merged.metadata = { isHamburger: true };
            return merged;
        }
    }

    return hamburger;
}
