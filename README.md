# FPT AI Token Factory

See [ROADMAP.md](./ROADMAP.md) for the persisted next plan covering time-lapse lighting, vehicle traffic, and focused factory presentation.

A miniature AI city built with Next.js, TypeScript, imperative Three.js WebGPURenderer, TSL depth of field, GSAP, and React overlays. No React Three Fiber. All current assets are procedural primitives.

## Run

```sh
npm install
npm run dev -- --port 3000
```

Open http://localhost:3000. Node 18.18+ is supported; Node 22 LTS is recommended for new environments. WebGPU needs a secure context (HTTPS or localhost). Three.js automatically uses its WebGL2 backend when WebGPU is unavailable.

## Milestone One

- Six distinct factory silhouettes, an animated central token router, roads, and instanced window/lighting props.
- Overview orbit limited to +/-35 degrees azimuth and 43-62 degrees polar, with no panning and bounded zoom.
- Raycast factory selection, 1.45-second camera transitions, +/-12-degree focused orbit, background/Back/Escape reset, and interruptible model navigation.
- TSL depth-buffer-based depth of field with smoothly tracked camera-space focus distance. Nonselected factory materials darken and desaturate; opacity is never used for focus.
- Bidirectional instanced cube traffic along CatmullRomCurve3 paths.
- Day/night lighting, emissive buildings, street-light heads, and token intensity.
- Responsive HTML model panels, projected labels, model navigation, accessible controls, and an API request preview with copy support.

Model context lengths are explicitly unverified; token usage and traffic are simulated. The API dialog is a request template, not a connected service. No credentials or external inference calls are included.

## Organization

| Path                        | Responsibility                                                           |
| --------------------------- | ------------------------------------------------------------------------ |
| `src/experience/core`       | Renderer lifecycle, scene coordination, raycasts, pooled resources       |
| `src/experience/world`      | Factory application object, city, core, lighting                         |
| `src/experience/camera`     | Art-directed camera transitions and orbit constraints                    |
| `src/experience/effects`    | TSL depth-of-field render pipeline                                       |
| `src/experience/simulation` | TokenSimulation contract and CPU instanced implementation                |
| `src/experience/loaders`    | PrimitiveFactoryAsset, GLTFFactoryAsset, common anchor/material behavior |
| `src/components`            | React overlays and API dialog                                            |
| `src/data`                  | Model catalog and asset URL selection                                    |
| `src/types`                 | Asset and application contracts                                          |

## Replace a Factory With a GLB

Place an asset in `public/models/` and set its model's `assetUrl` in `src/data/models.ts`, for example `assetUrl: '/models/deepseek.glb'`. `Factory.create()` picks the loader. Camera, selection, token simulation, and UI only use `FactoryAsset`; none of those systems depend on BoxGeometry.

Author GLBs in meters, Y-up, with the ground at Y=0, a centered origin, and a footprint of approximately 5.6 by 4.6 units. Apply transforms before exporting. Use glTF standard/PBR materials for consistent focus and night treatment.

```text
ROOT
  VISUAL
  COLLIDER
  CameraAnchor
  CameraTarget
  TokenInput
  TokenOutput
  UIAnchor
```

`COLLIDER` can contain multiple simplified meshes; they are hidden from rendering and explicitly raycast. Without a collider, visible meshes are used. Named anchors are preserved and returned in world space. Missing anchors get generated defaults based on the factory height and standard district footprint. Keep CameraAnchor in front of the factory. The common asset implementation owns emphasis/night changes; the loader owns geometry, material, and texture cleanup. Failed model loads show a recoverable error.

## Simulation and Performance

`TokenSimulation` exposes `root`, `update(delta, elapsed)`, `setNight`, and `dispose`. A future TSL compute implementation can replace `CPUTokenSimulation` without altering the scene, factory, camera, or UI interfaces. Input/output positions come from asset anchors; curves are created once when assets load.

Geometry and materials are reused per resource owner. Token cubes, windows, road markings, light posts, and simple shrubs are instanced. Future people, trees, and cars should be added as instanced transform batches, not individual React/Three objects. Animation scratch vectors and matrices are reused. DPR is capped at 2, animation pauses in hidden tabs, and reduced-motion preferences stop ambient animation and remove camera transition motion. DOF is bypassed in overview. Shadows use one directional light and a 2048px map. No complex assets, characters, or compute shaders are included yet.

60fps is the desktop target, not a measured guarantee. Profile on deployment hardware, especially at DPR 2 with DOF active; software Vulkan browser tests cannot establish hardware performance. Nonselected objects at the same camera-space depth can remain sharp, as expected with physical depth of field.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm exec playwright install chromium
# With the application running:
node scripts/browser-check.mjs
# Force the WebGL2 fallback through the same tests:
FORCE_WEBGL=1 node scripts/browser-check.mjs
```

The browser script checks nonblank pixels, changing animation, raycasting, rapid navigation, background reset, day/night, the API dialog, and mobile overflow. Screenshots are written to `test-results/`. Linux CI uses software Vulkan flags for WebGPU; test runs on a real GPU should omit those flags. `TEST_URL` can point to another server, and `HEADED=1` enables a visible browser when a display is available.

The PostCSS override applies a security fix to Next.js 15's transitive dependency. Keep the lockfile checked in. External Google Fonts are optional; system fonts are the fallback.
