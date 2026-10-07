# Vendored Babylon.js runtime assets

The game used to fetch these from third-party hosts at runtime. They are bundled here so a
deployment only needs its own host - no `cdn.babylonjs.com`, `assets.babylonjs.com` or
`raw.githubusercontent.com` - which matters on store networks that allow-list outbound hosts.

All files are from the Babylon.js project, Apache License 2.0
(https://github.com/BabylonJS/Babylon.js/blob/master/license.md).

| File | Source | Used by |
|---|---|---|
| `draco/draco_wasm_wrapper_gltf.js` | `@babylonjs/core@7.54.3` `assets/Draco/` | `src/components/babylonRunner.ts` |
| `draco/draco_decoder_gltf.wasm` | `@babylonjs/core@7.54.3` `assets/Draco/` | `src/components/babylonRunner.ts` |
| `draco/draco_decoder_gltf.js` | `@babylonjs/core@7.54.3` `assets/Draco/` | `src/components/babylonRunner.ts` |
| `environments/environmentSpecular.bin` | https://assets.babylonjs.com/environments/environmentSpecular.env | `src/components/scene/sceneManager.ts` |
| `textures/flare.png` | https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png | `src/components/player/celebrationVFX.ts` |
| `textures/cloud.png` | https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/cloud.png | `src/components/player/impactVFX.ts` |

Notes:

- `environmentSpecular.bin` is the `.env` file renamed. Web application firewalls (including
  Azure Front Door's managed rules) commonly block any path ending in `.env` as a leaked-secrets
  probe. The code passes `".env"` as the forced extension, so Babylon still uses its `.env`
  loader.
- No model in `public/scene/assets` is Draco-compressed today, so the decoder is only loaded if one
  is added. The previous config pointed `wasmBinaryUrl` at `draco_wasm_wrapper_gltf.wasm`, which
  does not exist on the CDN; the bundled pair is the correct one.
- If you upgrade `@babylonjs/core`, recopy the three Draco files from
  `node_modules/@babylonjs/core/assets/Draco/` to keep them in step.
