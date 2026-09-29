# FPT AI Token Factory

See [ROADMAP.md](./ROADMAP.md) for the persisted plan. Milestones 1 and 2 and the locked city tour are complete. Milestone 3 vehicle traffic is implemented; real-GPU profiling remains pending.

A miniature AI city built with Next.js, TypeScript, imperative Three.js WebGPURenderer, TSL focus blur, GSAP, and React overlays. No React Three Fiber. The city combines procedural geometry with optimized GLB buildings, characters and trees.

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

- The view opens focused on the FPT Core, the central token router, and is always locked to a stop. Dragging adjusts the view within a 30-degree horizontal arc (±15°); each new stop resets the angle. There is no free pan or zoom.
- Previous and Next move through the core and the six districts and wrap at both ends. Arrow keys do the same; Escape, Home, the house button, and the Home key return to the core.
- Clicking a neighbouring building or its floating tag focuses it. Clicking empty city keeps the current stop.
- The districts sit on a 10-unit block grid inside a compact 9×9 city (81 blocks, 45 units in every direction). Camera-relative fog hides the outer edge on wide and tall views. Locked tour shots use a 1.25× close framing so the active model and its visitors dominate the view; left-column shots mirror the camera angle to look back across the city.
- Everything outside the focused block turns gray and slightly darker: other factories, their glow, visitor crowds, trees, lots, and token lanes. A stronger background blur follows camera depth and screen distance, while the focused district stays sharp.
- Each model shop has a dense serpentine queue between silver stanchions and sagging red ropes. Every 0.5 seconds the line takes one short step: the front visitor enters and immediately exits onto a fast circuit around the building, while the returning runner rejoins the back. Exactly ten runners stay on each building circuit and nobody disappears. Waiting legs rest between steps; walking and running strides follow actual travel distance. Some visitors wear their district's brand color, and the supplied Grab rider appears among the crowd.
- Grab and FPT characters use three instanced parts from their optimized walking GLBs. Their one-second split-leg clips are sampled independently from distance travelled, so queue steps, normal walking, and running use matching leg cadence. FPT appears 1.5 times as often as Grab. The runtime assets retain all animation channels at about 120 KB and 110 KB respectively.
- Original GLB authoring exports live under the gitignored `.local-assets/glb/` folder. Only optimized runtime copies belong in `public/models/`.
- The core uses `ho-guom-v1.glb` (about 281 KB). Its separate `textured_mesh.obj.001` window object receives warm HDR emission, with a quarter-resolution highlight blur providing bloom. The original export stays in `.local-assets/glb/ho_guom (1).glb`.

## Time-Lapse City (Milestone 2)

- An accelerated city clock with a visible time and phase, pause/play, 1x/4x/12x speeds, and Day, Dusk, and Night presets. Presets move the clock forward smoothly and hold it until Play is pressed.
- The sun and moon share one continuous light path. Sky, fog, and ambient colors blend through night, dawn, day, golden hour, dusk, and blue hour.
- A single night value drives building windows, street lamps and their light pools, token intensity, and a warm light on the focused district. The page theme follows the city after dark.
- The clock stops in hidden tabs. With reduced motion it starts paused, presets jump instantly, and camera moves are immediate.

## Vehicle Traffic (Milestone 3)

- Compact low-poly cars and occasional bikes cruise the road grid on rounded, evenly spaced loops.
- Cars leave two short, fading warm light trails; bikes leave one. Trails start at the actual rear bulb faces at lamp height, follow the bulbs through turns, stay subtle by day, and brighten at night with the headlights.
- Vehicles and trails share their block's focus tint. Distant traffic pauses; reduced motion freezes vehicles and hides trails. The 1×/4×/12× speed control now drives vehicles, pedestrians, token flow, and the core animation together; the default 4× gives the whole city a time-lapse pace. Clock pause and day/night presets hold the lighting while ambient movement continues; reduced motion freezes everything.
- `VehicleAsset` is the model-replacement boundary: provide shared component geometry/materials, exact rear-light positions and colors, night treatment, and cleanup. `Traffic` accepts car and bike assets and owns their instanced rendering and movement. Models use meters, Y-up, +Z forward, and tires at ground level.

## Milestone One

- Six distinct factory silhouettes, an animated central token router, and instanced props.
- Raycast selection, 1.45-second interruptible camera transitions, and model navigation.
- TSL depth-aware focus blur with smoothly tracked camera-space focus distance. Opacity is never used for focus.
- Bidirectional instanced cube traffic along CatmullRomCurve3 paths.
- Responsive HTML model panels, projected labels, accessible controls, and an API request preview with copy support.

Model context lengths are explicitly unverified; token usage, crowd sizes, and traffic are simulated. The API dialog is a request template, not a connected service. No credentials or external inference calls are included.

## Organization

| Path                        | Responsibility                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `src/experience/core`       | Renderer lifecycle, tour selection, raycasts, pooled resources, focus tinting           |
| `src/experience/world`      | City grid and layout, core, crowds, vehicles, city clock, lighting, factory object      |
| `src/experience/camera`     | Locked shots, lens shift framing, and interruptible transitions                         |
| `src/experience/effects`    | TSL quarter-resolution blur and sharp-focus composite with a screen-space focus falloff |
| `src/experience/simulation` | TokenSimulation contract and CPU instanced implementation                               |
| `src/experience/loaders`    | Factory and vehicle asset implementations, common factory anchor/material behavior      |
| `src/components`            | React overlays, tour controls, time-lapse controls, and API dialog                      |
| `src/data`                  | Model catalog, tour order, and framework-free clock helpers                             |
| `src/types`                 | Asset and application contracts                                                         |

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

Geometry and materials are reused per resource owner. Filler buildings, window bands, lots, road markings, lamps, light pools, trees, token cubes, vehicle parts, light trails, queue ropes and posts, and every body part of the crowd are instanced. `TintedInstances` stores each instance's base color and city block, and rewrites instance colors only while focus emphasis is changing. Vehicles and their trails use the same batches. Crowd, vehicle, and token updates reuse scratch vectors, quaternions, and matrices and allocate nothing per frame. GPU pixel density is capped at 1.5 on desktop and 1.25 on mobile, with a 1.5-million-pixel frame budget and gradual adaptive scaling. Animation and the city clock pause in hidden tabs, and reduced-motion preferences stop ambient animation, pause the clock, and remove camera transition motion. Shadows use one directional light with a 1024px map whose frustum follows the focused district; the night focus light casts no shadow.

The city shows an initial core view before downloading the crowd, queue, vehicle, and token modules. Tour controls become available after the districts are prepared. The optional GLB loader is fetched only when a model has an `assetUrl`. Shared primitive resources create geometry only when used. DM Sans and Manrope variable font subsets are served locally, with their OFL licenses in `public/fonts/`; there are no Google Fonts requests on the client.

Background lots use one simple, shadow-free house each, with no bevels, rooftop machinery, or repeated window grids. Street markings and lamps are limited to the central neighbourhood. All district trees use alternating instanced `pin-tree-v1.glb` and `tree-v1.glb` assets loaded after the first city preview. Two quarter-resolution Gaussian passes replace the multi-pass bokeh effect; a depth/screen mask composites the focused block at the scene's full resolution.

The static city plus six shop models dropped from 20,222 placed instances / 487,878 triangles to 1,835 / 28,522, counted before culling. This is a geometry budget, not a measured frame rate. Unit tests enforce the smaller backdrop budget, fog coverage through camera transitions, and adaptive-resolution limits. 60fps remains a target requiring validation on real GPUs; software browser checks establish correctness, not hardware performance.

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
# Check progressive startup against the matching local out/ build:
node scripts/startup-check.mjs
```

Unit tests cover the asset contract, glTF loading, the city clock and lighting continuity, per-block graying, the locked camera, and vehicle lane continuity, sidewalk clearance, focus tinting, motion preferences, night lights, lamp-to-trail attachment through turns, time-lapse speed, queue clearance, and cleanup. The camera tests cast rays through every shot, several desktop and mobile viewports, and mid-transition poses. Every ray must point below the horizon and either land inside the city or reach fully opaque fog, and no filler block or other district may hide the focused plaza.

The browser script checks nonblank pixels, changing animation, the core default, wrapping Next/Previous, keyboard navigation, locked background clicks, tag and raycast selection, time-lapse pause/play/speed, day/dusk/night presets, the API dialog, mobile overflow, and rapid navigation. Screenshots are written to `test-results/`. Linux CI uses software Vulkan flags for WebGPU; test runs on a real GPU should omit those flags. `TEST_URL` can point to another server, `TEST_DPR=0.5` lowers render resolution for slow software GPUs while preserving desktop/mobile CSS framing, and `HEADED=1` enables a visible browser when a display is available.

The PostCSS override applies a security fix to Next.js 15's transitive dependency. Keep the lockfile checked in. The bundled local fonts use system fonts as their loading fallback.

The interface is a full-viewport city with compact glass panels, an overlaid title, Previous/Next navigation and time controls. The old header, model dock and footer have been removed. Usage, pricing and capabilities remain explicitly unavailable until a verified data source is connected.
