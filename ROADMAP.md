# FPT AI Token Factory Roadmap

Milestones 1 and 2 are complete, along with the locked city tour. This roadmap covers the remaining product passes for the city experience.

## Milestone 2: Time-Lapse City (complete)

An accelerated city clock with a visible time indicator and pause, speed, and preset controls.

- The clock runs at 2.5 city minutes per real second at 1x, with 1x, 4x (default), and 12x speeds. A visit starts at 16:30, so the first minute runs through golden hour into dusk.
- The key light follows one continuous sun-and-moon path, so its direction never jumps at sunrise or sunset. The shadow frustum follows the focused district.
- Sky, fog, and hemisphere colors blend through art-directed keyframes for night, dawn, day, golden hour, dusk, and blue hour.
- A single night value drives building emissive intensity, window bands, street-lamp heads, lamp light pools, token intensity, and a warm storefront light on the focused district.
- Day, Dusk, and Night presets move the clock forward smoothly and hold it there until Play is pressed.
- The clock only advances inside the render loop, so it stops in hidden tabs. With reduced motion, the clock starts paused and presets jump instantly.

## Locked City Tour (complete)

The camera is locked to art-directed shots and never shows the edge of the world.

- The FPT Core is the default and home stop. Previous and Next wrap through the core and the six districts, and so do the arrow keys and horizontal swipes. Escape and Home return to the core.
- There is no free orbit, pan, or zoom. Clicking empty city keeps the current stop. Clicking a neighbouring building or its floating tag focuses it.
- The districts sit on a 10-unit block grid, surrounded by filler blocks that extend 95 units in every direction. Fog relative to the camera fades the far city into the sky color.
- Left-column shots mirror the camera angle, so corner districts look back across the city instead of past its edge. The row nearest the camera stays low-rise so it never hides a district.
- Everything outside the focused block turns fully gray and slightly darker: factories, the core, their glow, visitor crowds, trees, lots, and token lanes. Opacity is never used.
- Depth of field blurs by camera-space depth and by screen distance from the focused district, so same-depth neighbours soften too.
- Unit tests cast rays through every shot, several desktop and mobile viewports, and mid-transition poses. Every ray must point below the horizon and land inside the city. They also check that no filler block or other district hides the focused plaza.

## Milestone 3: Vehicle Traffic

Add a small low-poly traffic system that makes the city feel active without turning it into a game.

- Create reusable blocky vehicle primitives first; preserve the same asset-replacement boundary used by factories.
- Define looped lane paths along the road grid in `src/experience/world/layout.ts`.
- Use InstancedMesh and pooled transforms for vehicles.
- Avoid per-frame allocations in the traffic update loop.
- Vary vehicle colors, scale, and speed within a restrained visual language.
- Gray vehicles outside the focused block with `TintedInstances`, like the crowds.
- Reduce or pause distant traffic while a stop is focused to preserve performance and attention.
- Keep vehicles compatible with the time-lapse lighting system, for example with headlights driven by the night value.

## Milestone 4: Focused Factory Presentation

The locked tour covers most of this milestone. The remaining refinement:

- Replace the procedural queue with crowd sizes driven by real token usage once a verified data source exists.
- Tune depth-of-field strength and the focus band on real desktop GPUs and high-DPR phones.
- Consider a per-stop camera override for GLB assets that need a custom angle.
- Test focused shots on physical mobile devices.

## Verification

Each milestone should include:

- Production TypeScript/build checks.
- Browser checks for desktop and mobile framing.
- Pixel/render checks for the active scene.
- Interaction checks for selection, camera transitions, the city clock, and navigation.
- Performance profiling on a real desktop GPU after vehicles are added.

## Current State

- Milestone 1: complete.
- Milestone 2: complete.
- Locked city tour: complete.
- Milestone 3: planned.
- Milestone 4: mostly delivered by the locked tour; refinement planned.

Model context lengths, token usage, and API access remain placeholders until a verified catalog and service endpoint are supplied. Crowd sizes and token traffic are simulated.
