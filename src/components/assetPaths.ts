// src/components/assetPaths.ts

export interface AssetRoots {
  assetBase: string;
  modelRoot: string;
  textureRoot: string;
}

export function getAssetRoots(): AssetRoots {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  // Use GitHub LFS CDN for Vercel deployments (LFS files aren't pulled during build)
  const isVercel = hostname.endsWith(".vercel.app") || hostname.endsWith("vercel.app");

  const assetBase = isVercel
    ? "https://media.githubusercontent.com/media/polymorphicteam/proto-sns-game/main/public/scene/assets/"
    : "scene/assets/";

  const modelRoot = `${assetBase}model/`;
  const textureRoot = `${assetBase}road/`;

  return { assetBase, modelRoot, textureRoot };
}
