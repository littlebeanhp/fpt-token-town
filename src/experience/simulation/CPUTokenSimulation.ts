import {
  CatmullRomCurve3,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  TubeGeometry,
  Vector3,
} from 'three/webgpu';
import { Resources } from '../core/Resources';
import type { Factory } from '../world/Factory';
import type { TokenSimulation } from './TokenSimulation';

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
  private tubes: TubeGeometry[] = [];
  private readonly count = 12;
  constructor(factories: Factory[]) {
    for (const factory of factories) {
      for (const direction of [1, -1]) {
        const end = factory.asset.getAnchor(
          direction === 1 ? 'TokenInput' : 'TokenOutput',
          new Vector3(),
        );
        const start = end.clone().normalize().multiplyScalar(2.5);
        start.y = 0.8;
        const middle = start.clone().lerp(end, 0.5);
        middle.y = 0.45;
        middle.x += direction * 0.5;
        const curve = new CatmullRomCurve3([start, middle, end]);
        const geometry = new TubeGeometry(curve, 32, 0.025, 4, false);
        this.tubes.push(geometry);
        this.root.add(new Mesh(geometry, this.resources.material(factory.model.color)));
        const cubes = new InstancedMesh(
          this.resources.cube,
          this.resources.material(factory.model.color, true),
          this.count,
        );
        cubes.instanceMatrix.setUsage(DynamicDrawUsage);
        cubes.frustumCulled = false;
        this.root.add(cubes);
        this.lanes.push({ curve, cubes, direction, speed: 1.35 / curve.getLength() });
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
  setNight(value: number) {
    for (const lane of this.lanes) {
      const material = lane.cubes.material;
      if (!Array.isArray(material) && 'emissiveIntensity' in material)
        material.emissiveIntensity = 0.8 + value * 3;
    }
  }
  dispose() {
    this.lanes.forEach((lane) => lane.cubes.dispose());
    this.tubes.forEach((tube) => tube.dispose());
    this.resources.dispose();
  }
}
