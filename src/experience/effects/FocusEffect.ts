import {
  RenderPipeline,
  Vector3,
  type PerspectiveCamera,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { pass, uniform } from 'three/tsl';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { gsap } from 'gsap';

export class FocusEffect {
  readonly focusDistance = uniform(35);
  readonly strength = uniform(0);
  private readonly scenePass;
  private readonly effect;
  private readonly pipeline: RenderPipeline;
  private direction = new Vector3();
  private offset = new Vector3();
  private tween?: gsap.core.Tween;
  constructor(
    private renderer: WebGPURenderer,
    private scene: Scene,
    private camera: PerspectiveCamera,
  ) {
    this.scenePass = pass(scene, camera);
    // A sharp depth band accommodates the full miniature instead of just one plane.
    const signedDepth = this.scenePass.getViewZNode().negate().sub(this.focusDistance);
    const focusDepth = this.focusDistance
      .add(signedDepth.sign().mul(signedDepth.abs().sub(3.2).max(0)))
      .negate();
    this.effect = dof(
      this.scenePass.getTextureNode('output'),
      focusDepth,
      this.focusDistance,
      uniform(3.5),
      this.strength,
    );
    this.pipeline = new RenderPipeline(renderer, this.effect);
  }
  select(active: boolean) {
    this.tween?.kill();
    this.tween = gsap.to(this.strength, {
      value: active ? 1.3 : 0,
      duration: 1.45,
      ease: 'power2.inOut',
    });
  }
  update(target: Vector3, delta: number) {
    this.camera.getWorldDirection(this.direction);
    const distance = this.offset.copy(target).sub(this.camera.position).dot(this.direction);
    this.focusDistance.value += (distance - this.focusDistance.value) * (1 - Math.exp(-delta * 12));
  }
  render() {
    if (this.strength.value < 0.005) this.renderer.render(this.scene, this.camera);
    else this.pipeline.render();
  }
  dispose() {
    this.tween?.kill();
    this.effect.dispose();
    this.scenePass.dispose();
    this.pipeline.dispose();
  }
}
