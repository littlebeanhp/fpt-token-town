import {
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  TubeGeometry,
  Vector3,
} from 'three/webgpu';
import type { FactoryId } from '@/types/factory';
import { Resources } from '../core/Resources';
import { tintForEmphasis } from '../core/emphasis';
import type { Factory } from '../world/Factory';
import type { TokenSimulation } from './TokenSimulation';

interface LaneStyle {
  tube: MeshStandardMaterial;
  cubes: MeshStandardMaterial;
  base: Color;
  emphasis: number;
}

export class CPUTokenSimulation implements TokenSimulation {
  readonly root = new Group();
  private resources = new Resources();
  private dummy = new Object3D();
  private point = new Vector3();
  private lanes: {
    curve: CatmullRomCurve3;
    cubes: InstancedMesh;
    direction: number;
    speed: number;
  }[] = [];
  private styles = new Map<FactoryId, LaneStyle>();
  private tubes: TubeGeometry[] = [];
  private night = 0;
  private readonly count = 14;
  constructor(factories: Factory[], origin: Vector3) {
    for (const factory of factories) {
      const style: LaneStyle = {
        tube: this.resources.material(factory.model.color),
        cubes: this.resources.material(factory.model.color, true),
        base: new Color(factory.model.color),
        emphasis: 1,
      };
      this.styles.set(factory.model.id, style);
      for (const direction of [1, -1]) {
        const end = factory.asset.getAnchor(
          direction === 1 ? 'TokenInput' : 'TokenOutput',
          new Vector3(),
        );
        const heading = end.clone().sub(origin).setY(0).normalize();
        const start = origin.clone().addScaledVector(heading, 2.7);
        start.y = 0.8;
        // Lanes arc over the streets; the in and out lanes separate sideways.
        const middle = start.clone().lerp(end, 0.5);
        middle.y = 0.8 + start.distanceTo(end) * 0.09;
        middle.x += -heading.z * direction * 0.45;
        middle.z += heading.x * direction * 0.45;
        const curve = new CatmullRomCurve3([start, middle, end]);
        const geometry = new TubeGeometry(curve, 48, 0.025, 4, false);
        this.tubes.push(geometry);
        this.root.add(new Mesh(geometry, style.tube));
        const cubes = new InstancedMesh(this.resources.cube, style.cubes, this.count);
        cubes.instanceMatrix.setUsage(DynamicDrawUsage);
        cubes.frustumCulled = false;
        this.root.add(cubes);
        this.lanes.push({ curve, cubes, direction, speed: 1.6 / curve.getLength() });
      }
    }
    this.dummy.scale.setScalar(0.115);
  }
  update(_delta: number, elapsed: number) {
    for (const lane of this.lanes) {
      for (let i = 0; i < this.count; i++) {
        const progress = (i / this.count + elapsed * lane.speed) % 1;
        lane.curve.getPointAt(lane.direction === 1 ? progress : 1 - progress, this.point);
        this.dummy.position.copy(this.point);
        this.dummy.rotation.set(elapsed * 0.5, i, 0);
        this.dummy.updateMatrix();
        lane.cubes.setMatrixAt(i, this.dummy.matrix);
      }
      lane.cubes.instanceMatrix.needsUpdate = true;
    }
  }
  /** Lanes follow their district's focus: background routes turn gray and dim. */
  setEmphasis(id: FactoryId, value: number) {
    const style = this.styles.get(id);
    if (!style) return;
    style.emphasis = value;
    const { r, g, b } = style.base;
    tintForEmphasis(r, g, b, value, style.tube.color);
    tintForEmphasis(r, g, b, value, style.cubes.color);
    tintForEmphasis(r, g, b, value, style.cubes.emissive);
    this.applyIntensity(style);
  }
  setNight(value: number) {
    this.night = value;
    this.styles.forEach((style) => this.applyIntensity(style));
  }
  private applyIntensity(style: LaneStyle) {
    style.cubes.emissiveIntensity = (0.8 + this.night * 3) * (0.3 + style.emphasis * 0.7);
  }
  dispose() {
    this.lanes.forEach((lane) => lane.cubes.dispose());
    this.tubes.forEach((tube) => tube.dispose());
    this.resources.dispose();
  }
}
