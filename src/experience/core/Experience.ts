import {
  ACESFilmicToneMapping,
  Box3,
  Raycaster,
  Scene,
  Sphere,
  Vector2,
  Vector3,
  WebGPURenderer,
  type Object3D,
} from 'three/webgpu';
import { gsap } from 'gsap';
import { coreStop, models, stops as stopDefinitions } from '@/data/models';
import type {
  DayPreset,
  ExperienceCallbacks,
  FactoryAsset,
  FactoryId,
  StopDefinition,
  StopId,
} from '@/types/factory';
import { CameraRig, createShot, type Shot } from '../camera/CameraRig';
import { FocusEffect } from '../effects/FocusEffect';
import { CPUTokenSimulation } from '../simulation/CPUTokenSimulation';
import type { TokenSimulation } from '../simulation/TokenSimulation';
import { City } from '../world/City';
import {
  CityClock,
  PRESET_HOURS,
  createLightingSample,
  formatClock,
  hoursUntil,
  phaseAt,
  sampleLighting,
  wrapHours,
} from '../world/CityClock';
import { Core } from '../world/Core';
import { Crowd } from '../world/Crowd';
import { Factory } from '../world/Factory';
import { Lighting } from '../world/Lighting';
import { blockIndex, blockKey } from '../world/layout';
import { BACKGROUND_EMPHASIS } from './emphasis';

interface Stop {
  definition: StopDefinition;
  asset: FactoryAsset;
  shot: Shot;
  key: number;
  label: HTMLElement | null;
  /** Rendered tag size in pixels, refreshed with the overlay boxes. */
  labelSize: [number, number];
}

const EMPHASIS_SECONDS = 1.45;
/** Minimum space, in pixels, between a neighbour tag and the frame edge or an overlay. */
const LABEL_GAP = 12;

export class Experience {
  private readonly scene = new Scene();
  private readonly renderer = new WebGPURenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  private readonly rig: CameraRig;
  private readonly lighting: Lighting;
  private city?: City;
  private crowd?: Crowd;
  private core?: Core;
  private effects?: FocusEffect;
  private simulation?: TokenSimulation;
  private factories: Factory[] = [];
  private stops: Stop[] = [];
  private colliders: Object3D[] = [];
  private owners = new Map<Object3D, StopId>();
  private keyToStop = new Map<number, StopId>();
  private emphasis = Object.fromEntries(stopDefinitions.map((stop) => [stop.id, 1])) as Record<
    StopId,
    number
  >;
  private emphasisDirty = true;
  private emphasisTween?: gsap.core.Tween;
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private pointerDown = new Vector2();
  private projected = new Vector3();
  private overlays: [number, number, number, number][] = [];
  private labelContainer: HTMLElement;
  private selectedIndex = 0;
  private disposed = false;
  private ready = false;
  private rendererInitialized = false;
  private width = 1;
  private height = 1;
  private previous = 0;
  private elapsed = 0;
  private crowdElapsed = -1;
  private frame = 0;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private clock = new CityClock(undefined, this.reduced);
  private clockTween?: gsap.core.Tween;
  private sample = createLightingSample();
  private appliedNight = -1;
  private reported = { step: -1, night: false, paused: false, speed: 0 };
  private observer: ResizeObserver;

  constructor(
    private container: HTMLElement,
    labelContainer: HTMLElement,
    private callbacks: ExperienceCallbacks,
  ) {
    const canvas = this.renderer.domElement;
    this.labelContainer = labelContainer;
    canvas.setAttribute('aria-label', 'Interactive FPT AI city');
    canvas.setAttribute('role', 'img');
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.onDeviceLost = () => {
      if (!this.disposed) {
        this.renderer.setAnimationLoop(null);
        this.callbacks.onError(
          'The graphics device was disconnected. Retry to reconnect the city.',
        );
      }
    };
    container.appendChild(canvas);
    this.rig = new CameraRig(canvas);
    this.lighting = new Lighting(this.scene, this.renderer);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  async init() {
    try {
      await this.renderer.init();
      this.rendererInitialized = true;
      if (this.disposed) {
        this.renderer.dispose();
        this.rendererInitialized = false;
        return;
      }
      this.core = new Core(coreStop);
      this.addStop(coreStop, this.core);
      for (const model of models) {
        const factory = await Factory.create(model);
        if (this.disposed) {
          factory.dispose();
          return;
        }
        this.factories.push(factory);
        this.addStop(model, factory.asset);
      }
      this.city = new City();
      this.crowd = new Crowd(
        this.stops.map(({ definition, asset }) => ({
          x: definition.position[0],
          z: definition.position[2],
          front: new Box3().setFromObject(asset.root).max.z,
          color: definition.color,
        })),
      );
      this.simulation = new CPUTokenSimulation(this.factories, new Vector3(...coreStop.position));
      this.scene.add(this.city.root, this.crowd.root, this.simulation.root);
      this.effects = new FocusEffect(this.renderer, this.scene, this.rig.camera);
      this.ready = true;
      this.resize();
      this.select(coreStop.id, true);
      this.updateLighting(true);
      this.applyEmphasis();
      this.crowd.update(0);
      await this.renderer.compileAsync(this.scene, this.rig.camera);
      if (this.disposed) return;
      const backend = 'isWebGPUBackend' in this.renderer.backend ? 'WebGPU' : 'WebGL2';
      this.renderer.domElement.dataset.backend = backend;
      this.callbacks.onReady(backend);
      this.effects.setActive(true, this.reduced);
      this.renderer.setAnimationLoop(this.animate);
    } catch (error) {
      if (!this.disposed) {
        console.error(error);
        this.callbacks.onError(
          'The 3D city could not start. Try a browser with WebGPU or WebGL2 enabled.',
        );
      }
    }
  }

  private addStop(definition: StopDefinition, asset: FactoryAsset) {
    asset.root.updateMatrixWorld(true);
    const [x, , z] = definition.position;
    const anchor = asset.getAnchor('CameraTarget', new Vector3());
    const bounds = new Box3().setFromObject(asset.root).getBoundingSphere(new Sphere());
    const key = blockKey(blockIndex(x), blockIndex(z));
    this.stops.push({
      definition,
      asset,
      key,
      label: this.labelContainer.querySelector<HTMLElement>(`[data-stop="${definition.id}"]`),
      labelSize: [0, 0],
      shot: createShot(definition.position, anchor.y, bounds.radius),
    });
    this.keyToStop.set(key, definition.id);
    this.scene.add(asset.root);
    for (const collider of asset.colliders) {
      this.colliders.push(collider);
      this.owners.set(collider, definition.id);
    }
  }

  get selected() {
    return this.stops[this.selectedIndex]?.definition.id ?? coreStop.id;
  }
  select(id: StopId, immediate = false) {
    if (!this.ready) return;
    const index = this.stops.findIndex((stop) => stop.definition.id === id);
    if (index < 0) return;
    this.selectedIndex = index;
    const stop = this.stops[index];
    this.rig.focus(stop.shot, immediate);
    this.emphasisTween?.kill();
    const targets = Object.fromEntries(
      this.stops.map(({ definition }) => [
        definition.id,
        definition.id === id ? 1 : BACKGROUND_EMPHASIS,
      ]),
    );
    this.emphasisTween = gsap.to(this.emphasis, {
      ...targets,
      duration: immediate || this.reduced ? 0 : EMPHASIS_SECONDS,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.emphasisDirty = true;
      },
    });
    this.emphasisDirty = true;
    this.renderer.domElement.dataset.selected = id;
    this.callbacks.onSelect(id);
  }
  /** Moves along the tour; the ends wrap so the city can be browsed in a loop. */
  step(direction: 1 | -1) {
    if (!this.ready) return;
    const count = this.stops.length;
    this.select(this.stops[(this.selectedIndex + direction + count) % count].definition.id);
  }

  setClockPaused(paused: boolean) {
    this.clock.paused = paused;
    this.emitClock(true);
  }
  setClockSpeed(speed: number) {
    this.clock.speed = speed;
    this.emitClock(true);
  }
  /** Moves the clock forward to a preset and holds it there until play is pressed. */
  jumpTo(preset: DayPreset) {
    this.clockTween?.kill();
    this.clock.paused = true;
    const start = this.clock.hours;
    const span = hoursUntil(start, PRESET_HOURS[preset]);
    const canvas = this.renderer.domElement;
    if (this.reduced || span < 0.01) {
      this.clock.hours = PRESET_HOURS[preset];
      this.clockTween = undefined;
      this.emitClock(true);
      return;
    }
    const state = { progress: 0 };
    canvas.dataset.lighting = 'transition';
    this.clockTween = gsap.to(state, {
      progress: 1,
      duration: Math.min(1.1 + span * 0.08, 2.4),
      ease: 'power2.inOut',
      onUpdate: () => {
        this.clock.hours = wrapHours(start + span * state.progress);
      },
      onComplete: () => {
        this.clockTween = undefined;
        this.emitClock(true);
      },
    });
    this.emitClock(true);
  }

  private updateLighting(force = false) {
    sampleLighting(this.clock.hours, this.sample);
    this.lighting.apply(this.sample, this.rig.target);
    this.lighting.setFogRange(this.rig.distance);
    if (force || Math.abs(this.sample.night - this.appliedNight) > 0.002) {
      this.appliedNight = this.sample.night;
      const value = this.sample.night;
      this.city?.setNight(value);
      this.simulation?.setNight(value);
      for (const stop of this.stops) stop.asset.setNight(value);
    }
    if (!this.clockTween) this.renderer.domElement.dataset.lighting = phaseAt(this.clock.hours);
    this.emitClock(force);
  }
  private emitClock(force = false) {
    const hours = this.clock.hours;
    const night = this.sample.night > 0.5;
    // Report in five-minute steps so React re-renders a few times per second at most.
    const step = Math.floor(hours * 12);
    const reported = this.reported;
    if (
      !force &&
      step === reported.step &&
      night === reported.night &&
      this.clock.paused === reported.paused &&
      this.clock.speed === reported.speed
    )
      return;
    reported.step = step;
    reported.night = night;
    reported.paused = this.clock.paused;
    reported.speed = this.clock.speed;
    this.renderer.domElement.dataset.clock = formatClock(hours);
    this.callbacks.onClock({
      hours,
      phase: phaseAt(hours),
      night,
      paused: this.clock.paused,
      speed: this.clock.speed,
    });
  }

  private emphasisForKey = (key: number) => {
    const id = this.keyToStop.get(key);
    return id ? this.emphasis[id] : BACKGROUND_EMPHASIS;
  };
  private applyEmphasis() {
    this.emphasisDirty = false;
    for (const stop of this.stops) stop.asset.setEmphasis(this.emphasis[stop.definition.id]);
    for (const factory of this.factories) {
      const id: FactoryId = factory.model.id;
      // The core routes every lane, so all lanes stay readable while it is in focus.
      this.simulation?.setEmphasis(id, Math.max(this.emphasis[id], this.emphasis.core));
    }
    this.city?.applyEmphasis(this.emphasisForKey);
    this.crowd?.applyEmphasis(this.emphasisForKey);
  }

  private resize = () => {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    if (!this.width || !this.height || this.disposed) return;
    this.renderer.setSize(this.width, this.height);
    this.rig.resize(this.width, this.height);
  };
  private pick(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const hit = this.raycaster.intersectObjects(this.colliders, false)[0];
    return hit ? (this.owners.get(hit.object) ?? null) : null;
  }
  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown.set(event.clientX, event.clientY);
  };
  private onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0 || !this.ready) return;
    const dx = event.clientX - this.pointerDown.x,
      dy = event.clientY - this.pointerDown.y;
    // A horizontal swipe steps through the tour; a tap on a neighbour focuses it.
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      this.step(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.hypot(dx, dy) < 6) {
      const id = this.pick(event);
      if (id && id !== this.selected) this.select(id);
    }
  };
  private onPointerMove = (event: PointerEvent) => {
    if (event.buttons || !this.ready) return;
    const id = this.pick(event);
    this.renderer.domElement.style.cursor = id && id !== this.selected ? 'pointer' : 'default';
  };
  private onVisibility = () => {
    this.previous = 0;
    if (this.ready && !this.disposed)
      this.renderer.setAnimationLoop(document.hidden ? null : this.animate);
  };

  private animate = (now: number) => {
    if (this.disposed) return;
    const delta = this.previous ? Math.min((now - this.previous) / 1000, 0.05) : 0;
    this.previous = now;
    if (!this.reduced) this.elapsed += delta;
    if (!this.clockTween) this.clock.advance(delta);
    this.updateLighting();
    if (this.emphasisDirty) this.applyEmphasis();
    this.core?.update(this.elapsed);
    this.simulation?.update(delta, this.elapsed);
    if (this.crowd && this.elapsed !== this.crowdElapsed) {
      this.crowdElapsed = this.elapsed;
      this.crowd.update(this.elapsed);
    }
    const stop = this.stops[this.selectedIndex];
    this.effects?.update(this.rig.target, stop.shot.radius, delta);
    this.effects?.render();
    if (this.frame % 2 === 0) this.updateLabels();
    this.frame++;
  };
  /**
   * Stage-relative boxes of the HTML overlays marked `data-overlay` (hero, panel, controls).
   * Re-read while the camera moves and twice a second otherwise, so React updates are seen.
   */
  private refreshOverlays() {
    const stage = this.container.parentElement;
    if (!stage) return;
    const origin = stage.getBoundingClientRect();
    this.overlays.length = 0;
    stage.querySelectorAll<HTMLElement>('[data-overlay]').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height)
        this.overlays.push([
          rect.left - origin.left - LABEL_GAP,
          rect.top - origin.top - LABEL_GAP,
          rect.right - origin.left + LABEL_GAP,
          rect.bottom - origin.top + LABEL_GAP,
        ]);
    });
    for (const stop of this.stops)
      if (stop.label) stop.labelSize = [stop.label.offsetWidth, stop.label.offsetHeight];
  }
  /** Neighbour tags follow their buildings, never covering the frame edge or an overlay. */
  private updateLabels() {
    if (this.rig.transitioning || this.frame % 30 === 0) this.refreshOverlays();
    for (let index = 0; index < this.stops.length; index++) {
      const stop = this.stops[index];
      if (!stop.label) continue;
      stop.asset.getAnchor('UIAnchor', this.projected).project(this.rig.camera);
      const { x, y, z } = this.projected;
      const px = (x * 0.5 + 0.5) * this.width,
        py = (-y * 0.5 + 0.5) * this.height;
      // Tags hang above their anchor, centred horizontally.
      const [width, height] = stop.labelSize;
      const left = px - width / 2,
        top = py - height;
      let visible =
        index !== this.selectedIndex &&
        z > -1 &&
        z < 1 &&
        left > LABEL_GAP &&
        top > LABEL_GAP &&
        left + width < this.width - LABEL_GAP &&
        py < this.height - LABEL_GAP;
      for (let o = 0; visible && o < this.overlays.length; o++) {
        const [x1, y1, x2, y2] = this.overlays[o];
        if (left < x2 && left + width > x1 && top < y2 && py > y1) visible = false;
      }
      stop.label.style.visibility = visible ? 'visible' : 'hidden';
      stop.label.style.transform = `translate(-50%, -100%) translate(${px}px, ${py}px)`;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.emphasisTween?.kill();
    this.clockTween?.kill();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.rig.dispose();
    this.effects?.dispose();
    this.simulation?.dispose();
    this.factories.forEach((factory) => factory.dispose());
    this.core?.dispose();
    this.crowd?.dispose();
    this.city?.dispose();
    this.lighting.dispose();
    if (this.rendererInitialized) {
      this.renderer.dispose();
      this.rendererInitialized = false;
    }
    canvas.remove();
  }
}
