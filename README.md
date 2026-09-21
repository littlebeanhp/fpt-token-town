# FPT AI Token Factory

See [ROADMAP.md](./ROADMAP.md) for the persisted plan. Milestones 1 and 2 and the locked city tour are complete; vehicle traffic is next.

A miniature AI city built with Next.js, TypeScript, imperative Three.js WebGPURenderer, TSL depth of field, GSAP, and React overlays. No React Three Fiber. All current assets are procedural primitives.

## Run

```sh
npm install
npm run dev -- --port 3000
```

Open http://localhost:3000. Node 18.18+ runs the app; Node 22 LTS is recommended and is required for Cloudflare's Wrangler CLI. WebGPU needs a secure context (HTTPS or localhost). Three.js automatically uses its WebGL2 backend when WebGPU is unavailable.

To preview the production build, run `npm run build`, then `npm start`, and open http://localhost:3000.

## Deploy

The city is a fully client-side page, so `npm run build` writes a static site to `out/`. No Node.js server runs in production.

### Cloudflare

One-time setup:

1. In the Cloudflare dashboard, create an API token from the **Edit Cloudflare Workers** template, and copy your **Account ID** from the Workers & Pages overview.
2. For automatic deploys, add both as GitHub repository secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` under Settings, Secrets and variables, Actions.

After that, every push to `main` runs the typecheck, unit tests, build, and deploy in `.github/workflows/deploy-cloudflare.yml`. **Run workflow** on the Actions tab redeploys by hand. Without the secrets, the workflow still checks and builds, then skips the deploy with a notice.

To deploy from your own machine, copy the credentials template and fill it in. `.env` is ignored by git and must never be committed.

```sh
cp .env.example .env
```

With Node 22 installed locally:

```sh
npm run deploy:cloudflare
```

On a machine whose Node is older than `.nvmrc`, deploy through a container instead. `scripts/deploy-docker.sh` copies the checkout to a temporary directory, then installs, builds, and deploys inside `node:22-alpine`, so no container-owned files land in your working tree. Extra arguments pass through to Wrangler.

```sh
npm run deploy:docker
npm run deploy:docker -- --dry-run   # build and validate without deploying
```

The site is served by a Workers static-assets project configured in `wrangler.jsonc`, at `https://fpt-token-town.<your-subdomain>.workers.dev`. Add a custom domain under the Worker's Domains & Routes settings. `public/_headers` sets long-lived caching for hashed assets and baseline security headers.

Cloudflare Pages also works: connect the repository with build command `npm run build` and output directory `out`.

### Docker, on any machine

```sh
docker compose up -d --build
```

Open http://localhost:8080. Without Compose:

```sh
docker build -t fpt-token-town .
docker run -d -p 8080:8080 --restart unless-stopped fpt-token-town
```

The image builds the export with Node 22 and serves it from unprivileged nginx on port 8080. `deploy/nginx.conf` adds gzip, one-year caching for hashed assets, no-cache HTML, and the same security headers. Browsers only allow WebGPU over HTTPS or on localhost, so a plain-HTTP address on a network falls back to WebGL2. Put the container behind an HTTPS reverse proxy or a Cloudflare Tunnel to keep WebGPU.

### Any static host

Upload the contents of `out/`, serve `404.html` for missing paths, and cache `/_next/static/` long-term.

## Locked City Tour

- The view opens focused on the FPT Core, the central token router, and is always locked to a stop. There is no overview, free orbit, pan, or zoom.
- Previous and Next move through the core and the six districts and wrap at both ends. Arrow keys and horizontal swipes do the same; Escape, Home, the house button, and the panel's back button return to the core.
- Clicking a neighbouring building or its floating tag focuses it. Clicking empty city keeps the current stop.
- The districts sit on a 10-unit block grid inside a filled city that extends 95 units in every direction, so no shot or transition can see the edge of the world. Left-column shots mirror the camera angle to look back across the city.
- Everything outside the focused block turns gray and slightly darker: other factories, their glow, visitor crowds, trees, lots, and token lanes. Depth of field blurs by camera-space depth and by screen distance from the focused district.
- Each district has a voxel visitor queue, and pedestrians walk the nearby sidewalks. Some visitors wear their district's brand color.

## Time-Lapse City (Milestone 2)

- An accelerated city clock with a visible time and phase, pause/play, 1x/4x/12x speeds, and Day, Dusk, and Night presets. Presets move the clock forward smoothly and hold it until Play is pressed.
- The sun and moon share one continuous light path. Sky, fog, and ambient colors blend through night, dawn, day, golden hour, dusk, and blue hour.
- A single night value drives building windows, street lamps and their light pools, token intensity, and a warm light on the focused district. The page theme follows the city after dark.
- The clock stops in hidden tabs. With reduced motion it starts paused, presets jump instantly, and camera moves are immediate.

## Milestone One

- Six distinct factory silhouettes, an animated central token router, and instanced props.
- Raycast selection, 1.45-second interruptible camera transitions, and model navigation.
- TSL depth-buffer-based depth of field with smoothly tracked camera-space focus distance. Opacity is never used for focus.
- Bidirectional instanced cube traffic along CatmullRomCurve3 paths.
- Responsive HTML model panels, projected labels, accessible controls, and an API request preview with copy support.

Model context lengths are explicitly unverified; token usage, crowd sizes, and traffic are simulated. The API dialog is a request template, not a connected service. No credentials or external inference calls are included.

## Organization

| Path                        | Responsibility                                                                |
| --------------------------- | ----------------------------------------------------------------------------- |
| `src/experience/core`       | Renderer lifecycle, tour selection, raycasts, pooled resources, focus tinting |
| `src/experience/world`      | City grid and layout, core, crowds, city clock, lighting, factory object      |
| `src/experience/camera`     | Locked shots, lens shift framing, and interruptible transitions               |
| `src/experience/effects`    | TSL depth-of-field render pipeline with a screen-space focus falloff          |
| `src/experience/simulation` | TokenSimulation contract and CPU instanced implementation                     |
| `src/experience/loaders`    | PrimitiveFactoryAsset, GLTFFactoryAsset, common anchor/material behavior      |
| `src/components`            | React overlays, tour controls, time-lapse controls, and API dialog            |
| `src/data`                  | Model catalog, tour order, and framework-free clock helpers                   |
| `src/types`                 | Asset and application contracts                                               |

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

`COLLIDER` can contain multiple simplified meshes; they are hidden from rendering and explicitly raycast. Without a collider, visible meshes are used. Named anchors are preserved and returned in world space. Missing anchors get generated defaults based on the factory height and standard district footprint. The locked camera uses CameraTarget for its height and the asset's bounding sphere for framing; the city chooses the camera direction so no shot can leave the city. CameraAnchor stays in the contract for custom tooling but no longer steers the tour. Keep the building's front facing +Z, where the visitor queue forms. The common asset implementation owns emphasis/night changes; the loader owns geometry, material, and texture cleanup. Failed model loads show a recoverable error.

Model positions in `src/data/models.ts` place each district on a block of the 10-unit grid, 0.9 units behind the block centre. The array order is the tour order after the core.

## Simulation and Performance

`TokenSimulation` exposes `root`, `update(delta, elapsed)`, `setNight`, `setEmphasis`, and `dispose`. A future TSL compute implementation can replace `CPUTokenSimulation` without altering the scene, factory, camera, or UI interfaces. Input/output positions come from asset anchors; curves are created once when assets load.

Geometry and materials are reused per resource owner. Filler buildings, window bands, lots, road markings, lamps, light pools, trees, token cubes, and every body part of the crowd are instanced. `TintedInstances` stores each instance's base color and city block, and rewrites instance colors only while focus emphasis is changing. Future cars should use the same batches. Crowd and token updates reuse scratch vectors, quaternions, and matrices and allocate nothing per frame. DPR is capped at 2, animation and the city clock pause in hidden tabs, and reduced-motion preferences stop ambient animation, pause the clock, and remove camera transition motion. Shadows use one directional light with a 2048px map whose frustum follows the focused district; the night focus light casts no shadow.

60fps is the desktop target, not a measured guarantee. Profile on deployment hardware, especially at DPR 2 with depth of field, which is always active in the locked tour. Software Vulkan browser tests run near one frame per second and cannot establish hardware performance.

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

Unit tests cover the asset contract, glTF loading, the city clock and lighting continuity, per-block graying, and the locked camera. The camera tests cast rays through every shot, several desktop and mobile viewports, and mid-transition poses. Every ray must point below the horizon and land inside the built-up city, and no filler block or other district may hide the focused plaza.

The browser script checks nonblank pixels, changing animation, the core default, wrapping Next/Previous, keyboard navigation, locked background clicks, tag and raycast selection, time-lapse pause/play/speed, day/dusk/night presets, the API dialog, mobile overflow, and rapid navigation. Screenshots are written to `test-results/`. Linux CI uses software Vulkan flags for WebGPU; test runs on a real GPU should omit those flags. `TEST_URL` can point to another server, and `HEADED=1` enables a visible browser when a display is available.

The PostCSS override applies a security fix to Next.js 15's transitive dependency. Keep the lockfile checked in. External Google Fonts are optional; system fonts are the fallback.
