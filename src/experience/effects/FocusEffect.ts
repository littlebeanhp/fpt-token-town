import {
  MathUtils,
  RenderPipeline,
  Vector2,
  Vector3,
  type PerspectiveCamera,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { float, length, pass, screenUV, select, smoothstep, uniform, vec2 } from 'three/tsl';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { gsap } from 'gsap';

/** Depth band around the focus that stays sharp, in world units. */
const SHARP_BAND = 3.4;
const FOCAL_LENGTH = 3.5;
const BOKEH = 2.8;

/**
 * Tilt-shift style focus. Blur grows with camera-space distance from the focused district
 * and with screen distance from it, so neighbours at the same depth soften too.
 */
export class FocusEffect {
  readonly focusDistance = uniform(35);
  readonly strength = uniform(0);
  private readonly center = uniform(new Vector2(0.5, 0.5));
  private readonly radius = uniform(0.3);
  private readonly aspect = uniform(1);
  private readonly scenePass;
  private readonly effect;
  private readonly pipeline: RenderPipeline;
  private direction = new Vector3();
  private offset = new Vector3();
  private projected = new Vector3();
  private tween?: gsap.core.Tween;
  constructor(
    private renderer: WebGPURenderer,
    private scene: Scene,
    private camera: PerspectiveCamera,
  ) {
    this.scenePass = pass(scene, camera);
    const signedDepth = this.scenePass.getViewZNode().negate().sub(this.focusDistance);
    const screenDistance = length(screenUV.sub(this.center).mul(vec2(this.aspect, 1)));
    const radial = smoothstep(this.radius.mul(0.95), this.radius.mul(1.9), screenDistance);
    const spread = signedDepth.abs().sub(SHARP_BAND).max(0).add(radial.mul(FOCAL_LENGTH));
    // Only geometry genuinely in front of the district uses near-field blur; everything
    // else blurs as background so it never bleeds over the focused building.
    const side = select(signedDepth.lessThan(-SHARP_BAND), float(-1), float(1));
    const focusDepth = this.focusDistance.add(side.mul(spread)).negate();
    this.effect = dof(
      this.scenePass.getTextureNode('output'),
      focusDepth,
      this.focusDistance,
      uniform(FOCAL_LENGTH),
      this.strength,
    );
    this.pipeline = new RenderPipeline(renderer, this.effect);
  }
  setActive(active: boolean, immediate = false) {
    this.tween?.kill();
    this.tween = gsap.to(this.strength, {
      value: active ? BOKEH : 0,
      duration: immediate ? 0 : 1.2,
      ease: 'power2.inOut',
    });
  }
  /** Tracks the focused district's depth and on-screen footprint. */
  update(target: Vector3, worldRadius: number, delta: number) {
    this.camera.getWorldDirection(this.direction);
    const depth = Math.max(
      this.offset.copy(target).sub(this.camera.position).dot(this.direction),
      1,
    );
    this.focusDistance.value += (depth - this.focusDistance.value) * (1 - Math.exp(-delta * 12));
    if (delta === 0) this.focusDistance.value = depth;
    this.projected.copy(target).project(this.camera);
    this.center.value.set(this.projected.x * 0.5 + 0.5, 0.5 - this.projected.y * 0.5);
    const halfHeight = depth * Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    this.radius.value = (worldRadius / halfHeight) * 0.5;
    this.aspect.value = this.camera.aspect;
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
