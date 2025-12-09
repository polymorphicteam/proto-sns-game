// src/components/assetPaths.ts

export interface AssetRoots {
  assetBase: string;
  modelRoot: string;
  textureRoot: string;
}

export function getAssetRoots(): AssetRoots {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  // Use GitHub LFS CDN for external deployments (GitHub Pages, Vercel, etc.)
  const isExternalDeployment =
    hostname.endsWith("github.io") ||
    hostname.endsWith("vercel.app") ||
    hostname.endsWith(".vercel.app");

  const assetBase = isExternalDeployment
    ? "https://media.githubusercontent.com/media/elektrazone/INFIN_BBOY_REPO/main/public/scene/assets/"
    : "scene/assets/";

  const modelRoot = `${assetBase}model/`;
  const textureRoot = `${assetBase}road/`;

  return { assetBase, modelRoot, textureRoot };
}
