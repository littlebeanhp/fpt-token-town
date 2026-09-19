import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';

export class Lighting {
  readonly sun = new DirectionalLight('#fff4dc', 3.3);
  readonly ambient = new HemisphereLight('#e6f6ff', '#92a29a', 2.6);
  private dayColor = new Color('#e7ede9');
  private nightColor = new Color('#172b32');
  private daySun = new Color('#fff4dc');
  private nightSun = new Color('#b2d6ff');
  constructor(
    private scene: Scene,
    renderer: WebGPURenderer,
  ) {
    scene.background = this.dayColor.clone();
    this.sun.position.set(-12, 24, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -22;
    this.sun.shadow.camera.far = 85;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.bias = -0.0002;
    scene.add(this.sun, this.ambient);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
  }
  setNight(value: number) {
    (this.scene.background as Color).copy(this.dayColor).lerp(this.nightColor, value);
    this.sun.intensity = 3.3 - value * 2.65;
    this.sun.color.copy(this.daySun).lerp(this.nightSun, value);
    this.ambient.intensity = 2.6 - value * 1.9;
  }
  dispose() {
    this.sun.shadow.dispose();
  }
}
