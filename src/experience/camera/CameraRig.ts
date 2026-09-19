import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import type { FactoryAsset } from '@/types/factory';

export class CameraRig {
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 250);
  readonly controls: OrbitControls;
  private tween?: gsap.core.Tween;
  private selected: FactoryAsset | null = null;
  private width = 1;
  private height = 1;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private canvas: HTMLCanvasElement) {
    this.camera.position.set(18, 25, 34);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.65;
    this.controls.target.set(0, 0.6, 0);
    this.configure(null);
    this.controls.update();
  }
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.focus(this.selected, this.canvas.dataset.transition !== 'active');
  }
  focus(asset: FactoryAsset | null, immediate = false) {
    this.selected = asset;
    this.tween?.kill();
    this.canvas.dataset.transition = 'active';
    const toTarget = asset
      ? asset.getAnchor('CameraTarget', new Vector3())
      : new Vector3(0, 0.6, 0);
    const toPosition = asset
      ? asset.getAnchor('CameraAnchor', new Vector3())
      : new Vector3(18, 25, 34);
    const distanceScale = Math.max(1, Math.min(2.05, 1.35 / (this.width / this.height)));
    toPosition.sub(toTarget).multiplyScalar(distanceScale).add(toTarget);
    const fromPosition = this.camera.position.clone(),
      fromTarget = this.controls.target.clone();
    // Clear residual orbit damping before the authored transition takes ownership.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enabled = false;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    const state = { progress: 0 };
    this.tween = gsap.to(state, {
      progress: 1,
      duration: immediate || this.reduced ? 0 : 1.45,
      ease: 'power3.inOut',
      onUpdate: () => {
        this.camera.position.lerpVectors(fromPosition, toPosition, state.progress);
        this.controls.target.lerpVectors(fromTarget, toTarget, state.progress);
        this.controls.update();
      },
      onComplete: () => {
        this.configure(asset);
        this.controls.enabled = true;
        this.controls.enableDamping = true;
        this.canvas.dataset.transition = 'idle';
      },
    });
  }
  private configure(asset: FactoryAsset | null) {
    const spherical = new Spherical().setFromVector3(
      this.camera.position.clone().sub(this.controls.target),
    );
    const theta = asset ? spherical.theta : 0;
    const range = MathUtils.degToRad(asset ? 12 : 35);
    this.controls.minAzimuthAngle = theta - range;
    this.controls.maxAzimuthAngle = theta + range;
    this.controls.minPolarAngle = asset ? spherical.phi - 0.12 : MathUtils.degToRad(43);
    this.controls.maxPolarAngle = asset ? spherical.phi + 0.12 : MathUtils.degToRad(62);
    this.controls.minDistance = spherical.radius * (asset ? 0.9 : 0.8);
    this.controls.maxDistance = spherical.radius * (asset ? 1.13 : 1.18);
  }
  update() {
    if (this.controls.enabled) this.controls.update();
  }
  dispose() {
    this.tween?.kill();
    this.controls.dispose();
  }
}
