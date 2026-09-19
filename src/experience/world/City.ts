import { Color, Group, InstancedMesh, Object3D } from 'three/webgpu';
import { Resources } from '../core/Resources';

export class City {
  readonly root = new Group();
  private resources = new Resources();
  private instances: InstancedMesh[] = [];
  private dayGround = new Color('#e6ece8');
  private nightGround = new Color('#19383c');
  constructor() {
    const r = this.resources;
    r.block(this.root, [0, -0.8, 0], [26, 1.3, 23], r.material('#b2c7c6'));
    r.block(this.root, [0, -0.16, 0], [26.15, 0.16, 23.15], r.material('#d8e4df'));
    r.block(this.root, [0, -1.55, 0], [1000, 0.1, 1000], r.material('#e6ece8'));
    const road = r.material('#83999b');
    for (const x of [-4, 4]) r.block(this.root, [x, -0.05, 0], [1.65, 0.08, 21.5], road);
    for (const z of [-2.6, 2.3]) r.block(this.root, [0, -0.045, z], [24.8, 0.08, 1.35], road);
    const paint: [number, number, number][] = [];
    for (const x of [-4, 4])
      for (let z = -10; z <= 10; z += 1.2)
        if (Math.abs(z + 2.6) > 1 && Math.abs(z - 2.3) > 1) paint.push([x, 0.01, z]);
    this.instance(paint, [0.055, 0.018, 0.5], '#dbe7df');
    const bollards: [number, number, number][] = [];
    for (const x of [-12, 12]) for (let z = -9; z <= 9; z += 3) bollards.push([x, 0.32, z]);
    this.instance(bollards, [0.16, 0.65, 0.16], '#4c6972');
    this.instance(
      bollards.map(([x, , z]) => [x, 0.7, z]),
      [0.25, 0.13, 0.25],
      '#b2ffda',
      true,
    );
    // Instanced prop batches can also host future tree, people, and car transforms.
    const shrubs: [number, number, number][] = [
      [-11, 0.3, -8],
      [-10, 0.3, -8],
      [10, 0.3, -8],
      [11, 0.3, -8],
      [-11, 0.3, 8],
      [-10, 0.3, 8],
      [10, 0.3, 8],
      [11, 0.3, 8],
    ];
    this.instance(shrubs, [0.65, 0.6, 0.65], '#82a990');
  }
  private instance(
    positions: [number, number, number][],
    size: [number, number, number],
    color: string,
    emissive = false,
  ) {
    const mesh = new InstancedMesh(
      this.resources.box,
      this.resources.material(color, emissive),
      positions.length,
    );
    const dummy = new Object3D();
    dummy.scale.set(...size);
    positions.forEach((position, index) => {
      dummy.position.set(...position);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.instances.push(mesh);
  }
  setNight(value: number) {
    this.resources.material('#e6ece8').color.copy(this.dayGround).lerp(this.nightGround, value);
    this.resources.material('#b2ffda', true).emissiveIntensity = 0.2 + value * 3;
  }
  dispose() {
    this.instances.forEach((mesh) => mesh.dispose());
    this.resources.dispose();
  }
}
