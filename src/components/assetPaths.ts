// src/components/assetPaths.ts

export interface AssetRoots {
  assetBase: string;
  modelRoot: string;
  textureRoot: string;
}

export function getAssetRoots(): AssetRoots {
  // Use relative paths - webpack CopyWebpackPlugin copies public/scene to dist/scene
  const assetBase = "scene/assets/";
  const modelRoot = `${assetBase}model/`;
  const textureRoot = `${assetBase}road/`;

  return { assetBase, modelRoot, textureRoot };
}
