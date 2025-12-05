// src/components/obstacles/hamburgerBuilder.ts
import * as BABYLON from "@babylonjs/core";

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
    // MATERIALS
    // ============================================

    // Bun (golden brown)
    const bunMaterial = new BABYLON.StandardMaterial("bunMat", scene);
    bunMaterial.diffuseColor = new BABYLON.Color3(0.85, 0.55, 0.25);
    bunMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    // Sesame seeds (cream/white)
    const sesameMaterial = new BABYLON.StandardMaterial("sesameMat", scene);
    sesameMaterial.diffuseColor = new BABYLON.Color3(0.95, 0.92, 0.8);

    // Patty (dark brown)
    const pattyMaterial = new BABYLON.StandardMaterial("pattyMat", scene);
    pattyMaterial.diffuseColor = new BABYLON.Color3(0.35, 0.2, 0.1);
    pattyMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Lettuce (green)
    const lettuceMaterial = new BABYLON.StandardMaterial("lettuceMat", scene);
    lettuceMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.7, 0.2);
    lettuceMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Tomato (red)
    const tomatoMaterial = new BABYLON.StandardMaterial("tomatoMat", scene);
    tomatoMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.15);
    tomatoMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    // Cheese (yellow/orange)
    const cheeseMaterial = new BABYLON.StandardMaterial("cheeseMat", scene);
    cheeseMaterial.diffuseColor = new BABYLON.Color3(1.0, 0.8, 0.2);
    cheeseMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

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
    bottomBun.material = bunMaterial;
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
    patty.material = pattyMaterial;
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
    cheese.material = cheeseMaterial;
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
        leaf.material = lettuceMaterial;
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
    tomato1.material = tomatoMaterial;
    tomato1.position.y = yOffset;
    tomato1.position.x = -1.5 * scale;
    tomato1.parent = hamburger;

    const tomato2 = BABYLON.MeshBuilder.CreateCylinder(
        "tomato2",
        { diameter: tomatoRadius * 2, height: tomatoHeight, tessellation: 16 },
        scene
    );
    tomato2.material = tomatoMaterial;
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
    topBun.material = bunMaterial;
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
        seed.material = sesameMaterial;
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
            true,  // Allow different materials  
            hamburger, // Parent
            false, // Don't subdivide
            true   // Multi-material
        );
        if (merged) {
            merged.name = "obs_hamburger";
            return merged;
        }
    }

    return hamburger;
}
