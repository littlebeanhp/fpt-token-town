import {
  ACESFilmicToneMapping,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGPURenderer,
  type Object3D,
} from 'three/webgpu';
import { gsap } from 'gsap';
import { models } from '@/data/models';
import type { ExperienceCallbacks, FactoryId } from '@/types/factory';
import { CameraRig } from '../camera/CameraRig';
import { FocusEffect } from '../effects/FocusEffect';
import { CPUTokenSimulation } from '../simulation/CPUTokenSimulation';
import type { TokenSimulation } from '../simulation/TokenSimulation';
import { City } from '../world/City';
import { Core } from '../world/Core';
import { Factory } from '../world/Factory';
import { Lighting } from '../world/Lighting';

export class Experience {
  private readonly scene = new Scene();
  private readonly renderer = new WebGPURenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  private readonly rig: CameraRig;
  private readonly city = new City();
  private readonly core = new Core();
  private readonly lighting: Lighting;
  private effects?: FocusEffect;
  private simulation?: TokenSimulation;
  private factories: Factory[] = [];
  private colliders: Object3D[] = [];
  private owners = new Map<Object3D, FactoryId>();
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private pointerDown = new Vector2();
  private projected = new Vector3();
  private focus = new Vector3();
  private labels = new Map<FactoryId, HTMLElement>();
  private coreLabel: HTMLElement | null;
  private selected: FactoryId | null = null;
  private disposed = false;
  private ready = false;
  private rendererInitialized = false;
  private width = 1;
  private height = 1;
  private previous = 0;
  private elapsed = 0;
  private frame = 0;
  private day = { value: 0 };
  private nightTween?: gsap.core.Tween;
  private emphasisTweens: gsap.core.Tween[] = [];
  private observer: ResizeObserver;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private container: HTMLElement,
    labelContainer: HTMLElement,
    private callbacks: ExperienceCallbacks,
  ) {
    const canvas = this.renderer.domElement;
    this.coreLabel = labelContainer.querySelector('[data-core]');
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
    this.scene.add(this.city.root, this.core.root);
    models.forEach((model) => {
      const label = labelContainer.querySelector<HTMLElement>(`[data-model="${model.id}"]`);
      if (label) this.labels.set(model.id, label);
    });
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
      for (const model of models) {
        const factory = await Factory.create(model);
        if (this.disposed) {
          factory.dispose();
          return;
        }
        this.factories.push(factory);
        this.scene.add(factory.asset.root);
        for (const collider of factory.asset.colliders) {
          this.colliders.push(collider);
          this.owners.set(collider, model.id);
        }
      }
      this.simulation = new CPUTokenSimulation(this.factories);
      this.scene.add(this.simulation.root);
      this.effects = new FocusEffect(this.renderer, this.scene, this.rig.camera);
      this.ready = true;
      this.resize();
      this.applyNight();
      await this.renderer.compileAsync(this.scene, this.rig.camera);
      if (this.disposed) return;
      const backend = 'isWebGPUBackend' in this.renderer.backend ? 'WebGPU' : 'WebGL2';
      this.renderer.domElement.dataset.backend = backend;
      this.callbacks.onReady(backend);
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
  select(id: FactoryId | null) {
    if (!this.ready) return;
    const factory = this.factories.find((item) => item.model.id === id);
    this.selected = factory?.model.id ?? null;
    this.rig.focus(factory?.asset ?? null);
    this.effects?.select(!!factory);
    this.emphasisTweens.forEach((tween) => tween.kill());
    this.emphasisTweens.length = 0;
    for (const item of this.factories) {
      const state = { value: Number(item.asset.root.userData.emphasis ?? 1) };
      this.emphasisTweens.push(
        gsap.to(state, {
          value: !factory || factory === item ? 1 : 0.28,
          duration: 1.45,
          onUpdate: () => {
            item.asset.setEmphasis(state.value);
            item.asset.root.userData.emphasis = state.value;
          },
        }),
      );
    }
    this.callbacks.onSelect(this.selected);
  }
  setNight(night: boolean) {
    this.renderer.domElement.dataset.lighting = 'transition';
    this.nightTween?.kill();
    this.nightTween = gsap.to(this.day, {
      value: night ? 1 : 0,
      duration: this.reduced ? 0 : 1.2,
      onUpdate: () => this.applyNight(),
      onComplete: () => {
        this.renderer.domElement.dataset.lighting = night ? 'night' : 'day';
      },
    });
  }
  private applyNight() {
    const value = this.day.value;
    this.lighting.setNight(value);
    this.core.setNight(value);
    this.city.setNight(value);
    this.simulation?.setNight(value);
    this.factories.forEach((factory) => factory.asset.setNight(value));
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
    if (event.button !== 0 || !this.rig.controls.enabled) return;
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) < 6)
      this.select(this.pick(event));
  };
  private onPointerMove = (event: PointerEvent) => {
    if (!event.buttons && this.ready)
      this.renderer.domElement.style.cursor = this.pick(event) ? 'pointer' : 'grab';
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
    this.rig.update();
    this.core.update(this.elapsed);
    this.simulation?.update(delta, this.elapsed);
    this.focus.copy(this.rig.controls.target);
    this.effects?.update(this.focus, delta);
    this.effects?.render();
    if (this.frame++ % 2 === 0) {
      if (this.coreLabel) {
        this.projected.set(0, 5.8, 0).project(this.rig.camera);
        this.coreLabel.style.visibility = this.selected ? 'hidden' : 'visible';
        this.coreLabel.style.transform = `translate(-50%, -100%) translate(${(this.projected.x * 0.5 + 0.5) * this.width}px, ${(-this.projected.y * 0.5 + 0.5) * this.height}px)`;
      }
      for (const factory of this.factories) {
        const label = this.labels.get(factory.model.id);
        if (!label) continue;
        factory.asset.getAnchor('UIAnchor', this.projected).project(this.rig.camera);
        const visible = !this.selected && this.projected.z > -1 && this.projected.z < 1;
        label.style.visibility = visible ? 'visible' : 'hidden';
        label.style.transform = `translate(-50%, -100%) translate(${(this.projected.x * 0.5 + 0.5) * this.width}px, ${(-this.projected.y * 0.5 + 0.5) * this.height}px)`;
      }
    }
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.nightTween?.kill();
    this.emphasisTweens.forEach((tween) => tween.kill());
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.rig.dispose();
    this.effects?.dispose();
    this.simulation?.dispose();
    this.factories.forEach((factory) => factory.dispose());
    this.city.dispose();
    this.core.dispose();
    this.lighting.dispose();
    if (this.rendererInitialized) {
      this.renderer.dispose();
      this.rendererInitialized = false;
    }
    canvas.remove();
  }
}
