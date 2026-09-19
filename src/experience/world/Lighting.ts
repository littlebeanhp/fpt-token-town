import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFShadowMap,
  PointLight,
  type Scene,
  type Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import type { LightingSample } from './CityClock';

const LIGHT_DISTANCE = 42;
const SHADOW_HALF_SIZE = 26;

export class Lighting {
  readonly sun = new DirectionalLight('#fff4dc', 3.3);
  readonly ambient = new HemisphereLight('#e6f6ff', '#92a29a', 2.6);
  /** Warm storefront light that keeps the focused district readable after dark. */
  readonly focusLight = new PointLight('#ffcf94', 0, 15, 1.2);
  // Distant blocks fade into the sky color, so the far city reads as atmosphere, not an edge.
  readonly fog = new Fog('#e7ede9', 30, 110);
  private background = new Color('#e7ede9');
  constructor(scene: Scene, renderer: WebGPURenderer) {
    scene.background = this.background;
    scene.fog = this.fog;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -SHADOW_HALF_SIZE;
    shadowCamera.right = SHADOW_HALF_SIZE;
    shadowCamera.top = SHADOW_HALF_SIZE;
    shadowCamera.bottom = -SHADOW_HALF_SIZE;
    shadowCamera.near = 1;
    shadowCamera.far = LIGHT_DISTANCE * 2.2;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.bias = -0.0002;
    scene.add(this.sun, this.sun.target, this.ambient, this.focusLight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
  }
  /** Applies a time-of-day sample; the key light and its shadow frustum follow the focus. */
  apply(sample: LightingSample, focus: Vector3) {
    this.background.copy(sample.sky);
    this.fog.color.copy(sample.sky);
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(sample.lightDirection, LIGHT_DISTANCE);
    this.sun.target.updateMatrixWorld();
    this.sun.intensity = sample.lightIntensity;
    this.sun.color.copy(sample.lightColor);
    this.ambient.color.copy(sample.hemiSky);
    this.ambient.groundColor.copy(sample.hemiGround);
    this.ambient.intensity = sample.hemiIntensity;
    this.focusLight.position.set(focus.x, focus.y + 3.4, focus.z + 3.6);
    this.focusLight.intensity = sample.night * 22;
  }
  /** Keeps fog relative to the camera so every framing hides the same far distance. */
  setFogRange(cameraDistance: number) {
    this.fog.near = cameraDistance + 10;
    this.fog.far = cameraDistance + 85;
  }
  dispose() {
    this.sun.shadow.dispose();
  }
}
