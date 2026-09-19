# FPT AI Token Factory Roadmap

The first implementation milestone is complete. This roadmap covers the next product pass for the city experience.

## Milestone 2: Time-Lapse City

Add an accelerated city clock with a visible time indicator and pause/speed controls.

- Animate the sun angle and directional-light direction.
- Transition sky/background color and ambient lighting through the day.
- Drive building emissive intensity, street-light brightness, and token-light intensity.
- Keep transitions smooth when switching between day, dusk, and night.
- Pause the clock when the tab is hidden and respect reduced-motion preferences.

## Milestone 3: Vehicle Traffic

Add a small low-poly traffic system that makes the city feel active without turning it into a game.

- Create reusable blocky vehicle primitives first; preserve the same asset-replacement boundary used by factories.
- Define looped lane paths around the city roads.
- Use InstancedMesh and pooled transforms for vehicles.
- Avoid per-frame allocations in the traffic update loop.
- Vary vehicle colors, scale, and speed within a restrained visual language.
- Reduce or pause distant traffic while a factory is focused to preserve performance and attention.
- Keep vehicles compatible with the time-lapse lighting system.

## Milestone 4: Focused Factory Presentation

Strengthen the selected model-house view when a user clicks a factory.

- Keep the selected factory sharp across its full silhouette using the TSL depth-of-field pass.
- Blur surrounding factories, roads, vehicles, props, and background by camera-space depth.
- Darken and desaturate surrounding districts without changing opacity.
- Animate focus distance and emphasis when moving from one factory to another.
- Keep the selected factory's token input/output lanes readable.
- Preserve the current camera limits, GSAP transition timing, Back button, Escape key, and background-click reset.
- Test focused shots on desktop and mobile viewports.

## Verification

Each milestone should include:

- Production TypeScript/build checks.
- Browser checks for desktop and mobile framing.
- Pixel/render checks for the active scene.
- Interaction checks for selection, camera transitions, day/night state, and reset behavior.
- Performance profiling on a real desktop GPU after vehicles are added.

## Current State

- Milestone 1: complete.
- Milestone 2: planned.
- Milestone 3: planned.
- Milestone 4: foundation exists; refinement planned.

Model context lengths, token usage, and API access remain placeholders until a verified catalog and service endpoint are supplied.
