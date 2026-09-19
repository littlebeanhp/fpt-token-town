import {
  AdditiveBlending,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
} from 'three/webgpu';
import { color, float, length, smoothstep, uniform, uv } from 'three/tsl';
import { Resources } from '../core/Resources';
import { TintedInstances } from '../core/TintedInstances';
import {
  BLOCK_PITCH,
  CITY_BLOCKS,
  LOT_HALF,
  LOT_SIZE,
  ROAD_WIDTH,
  SIDEWALK_HEIGHT,
  blockKey,
  createRandom,
  isDistrictBlock,
  isParkBlock,
} from './layout';

type Box = [x: number, y: number, z: number, w: number, h: number, d: number];

const BODY_COLORS = ['#dfe5e2', '#d3dcd9', '#c9d2d0', '#e4ded4', '#d8d1c6', '#cfd6dc', '#c2cbca'];
const ROOF_COLORS = ['#aebbba', '#a3adb0', '#b5b0a6', '#9eaaa8'];
/** Filler height ranges. The row nearest the camera stays low so it never hides a district. */
function heightRange(i: number, j: number): [number, number] {
  if (j === 2 && Math.abs(i) <= 3) return [0.9, 2.1];
  if (j === 3 && Math.abs(i) <= 3) return [1.4, 3.2];
  if (Math.abs(i) === 2 && Math.abs(j) <= 1) return [1.6, 4.2];
  if (j <= -2) return [2.4, 7.5];
  return [2, 6];
}

/**
 * The procedural city: a filled grid of blocks that extends beyond every locked camera view,
 * so no shot ever reaches an edge. Everything is instanced; district lots keep room for the
 * factories, the core, and two parks.
 */
export class City {
  readonly root = new Group();
  private resources = new Resources();
  private foliage = new IcosahedronGeometry(1, 0);
  private plane = new PlaneGeometry(1, 1);
  private meshes: InstancedMesh[] = [];
  private tinted: TintedInstances[] = [];
  private dummy = new Object3D();
  private scratch = new Color();
  private lampHeads: MeshStandardMaterial;
  private litWindows: MeshStandardMaterial;
  private poolStrength = uniform(0);
  private poolMaterial: MeshBasicNodeMaterial;
  private ground: Mesh;

  constructor() {
    const random = createRandom(20260919);
    const r = this.resources;
    this.lampHeads = new MeshStandardMaterial({
      color: '#fff1d6',
      emissive: '#ffcf8a',
      emissiveIntensity: 0.3,
    });
    this.litWindows = new MeshStandardMaterial({
      color: '#98adb4',
      emissive: '#ffd49a',
      emissiveIntensity: 0.05,
      roughness: 0.35,
    });
    // Lamp light pools: soft additive discs that only appear after dusk.
    const falloff = float(1).sub(smoothstep(0, 0.5, length(uv().sub(0.5))));
    this.poolMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.poolMaterial.colorNode = color('#ffbe6e');
    this.poolMaterial.opacityNode = falloff.mul(falloff).mul(this.poolStrength);
    this.poolMaterial.fog = false;

    this.ground = new Mesh(this.plane, r.material('#7f9295'));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.scale.set(1400, 1400, 1);
    this.ground.receiveShadow = true;
    this.root.add(this.ground);

    this.buildLots(random);
    this.buildFiller(random);
    this.buildStreets();
    this.buildLamps();
    this.buildTrees(random);
  }

  private blocks(range: number, visit: (i: number, j: number) => void) {
    for (let i = -range; i <= range; i++) for (let j = -range; j <= range; j++) visit(i, j);
  }
  private matrix([x, y, z, w, h, d]: Box, rotation = 0) {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, rotation, 0);
    this.dummy.scale.set(w, h, d);
    this.dummy.updateMatrix();
    return this.dummy.matrix;
  }
  private batch(
    geometry: BufferGeometry,
    material: Material,
    boxes: Box[],
    colors?: Color[],
    castShadow = true,
  ) {
    const mesh = new InstancedMesh(geometry, material, Math.max(boxes.length, 1));
    boxes.forEach((box, index) => {
      mesh.setMatrixAt(index, this.matrix(box));
      if (colors) mesh.setColorAt(index, colors[index]);
    });
    mesh.count = boxes.length;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }
  private tint(geometry: BufferGeometry, material: Material, capacity: number) {
    const batch = new TintedInstances(geometry, material, capacity);
    this.root.add(batch.mesh);
    this.tinted.push(batch);
    return batch;
  }

  private buildLots(random: () => number) {
    const span = CITY_BLOCKS * 2 + 1;
    const lots = this.tint(this.resources.box, this.resources.material('#ffffff'), span * span);
    const grass = this.tint(this.resources.cube, this.resources.material('#ffffff'), 4);
    this.blocks(CITY_BLOCKS, (i, j) => {
      const district = isDistrictBlock(i, j);
      const tone = district ? '#dde6e2' : random() < 0.5 ? '#cfd9d6' : '#d5dcd8';
      lots.add(
        this.matrix([
          i * BLOCK_PITCH,
          SIDEWALK_HEIGHT / 2,
          j * BLOCK_PITCH,
          LOT_SIZE,
          SIDEWALK_HEIGHT,
          LOT_SIZE,
        ]),
        this.scratch.set(tone),
        blockKey(i, j),
      );
      if (isParkBlock(i, j))
        grass.add(
          this.matrix([
            i * BLOCK_PITCH,
            SIDEWALK_HEIGHT + 0.03,
            j * BLOCK_PITCH,
            LOT_SIZE - 1.1,
            0.06,
            LOT_SIZE - 1.1,
          ]),
          this.scratch.set('#9dbb8f'),
          blockKey(i, j),
        );
    });
    lots.mesh.castShadow = false;
    grass.mesh.castShadow = false;
  }

  private buildFiller(random: () => number) {
    const bodies: Box[] = [],
      bodyColors: Color[] = [],
      roofs: Box[] = [],
      roofColors: Color[] = [],
      lit: Box[] = [],
      dark: Box[] = [];
    const inner = LOT_SIZE - 1.2;
    const quarter = inner / 4,
      half = inner / 2 - 0.35;
    this.blocks(CITY_BLOCKS, (i, j) => {
      if (isDistrictBlock(i, j)) return;
      const [minHeight, maxHeight] = heightRange(i, j);
      const layout = random();
      const footprints: [number, number, number, number][] =
        layout < 0.22
          ? [[0, 0, inner - 0.6, inner - 0.8]]
          : layout < 0.48
            ? [
                [-quarter, 0, half, inner - 0.8],
                [quarter, 0, half, inner - 0.8],
              ]
            : layout < 0.68
              ? [
                  [0, -quarter, inner - 0.6, half],
                  [0, quarter, inner - 0.6, half],
                ]
              : [
                  [-quarter, -quarter, half, half],
                  [quarter, -quarter, half, half],
                  [-quarter, quarter, half, half],
                  [quarter, quarter, half, half],
                ];
      for (const [fx, fz, w, d] of footprints) {
        const h = minHeight + random() * (maxHeight - minHeight);
        const x = i * BLOCK_PITCH + fx,
          z = j * BLOCK_PITCH + fz,
          top = SIDEWALK_HEIGHT + h;
        bodies.push([x, SIDEWALK_HEIGHT + h / 2, z, w, h, d]);
        bodyColors.push(new Color(BODY_COLORS[Math.floor(random() * BODY_COLORS.length)]));
        const roof = new Color(ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)]);
        roofs.push([x, top + 0.08, z, w + 0.16, 0.16, d + 0.16]);
        roofColors.push(roof);
        if (random() < 0.45) {
          roofs.push([
            x + (random() - 0.5) * w * 0.4,
            top + 0.4,
            z + (random() - 0.5) * d * 0.4,
            0.7,
            0.5,
            0.6,
          ]);
          roofColors.push(roof.clone().multiplyScalar(0.92));
        }
        // Window bands on the faces the locked cameras can see: front and both sides.
        for (let y = SIDEWALK_HEIGHT + 0.6; y < top - 0.35; y += 0.72) {
          (random() < 0.62 ? lit : dark).push([x, y, z + d / 2 + 0.02, w * 0.78, 0.26, 0.04]);
          (random() < 0.62 ? lit : dark).push([x + w / 2 + 0.02, y, z, 0.04, 0.26, d * 0.78]);
          (random() < 0.62 ? lit : dark).push([x - w / 2 - 0.02, y, z, 0.04, 0.26, d * 0.78]);
        }
      }
    });
    const white = this.resources.material('#ffffff');
    this.batch(this.resources.box, white, bodies, bodyColors).name = 'filler-bodies';
    this.batch(this.resources.box, white, roofs, roofColors).name = 'filler-roofs';
    this.batch(this.resources.cube, this.litWindows, lit, undefined, false);
    this.batch(this.resources.cube, this.resources.material('#5f7479'), dark, undefined, false);
  }

  private buildStreets() {
    const dashes: Box[] = [],
      stripes: Box[] = [];
    const reach = 55,
      clear = ROAD_WIDTH / 2 + 1.1;
    const roads: number[] = [];
    for (let k = -CITY_BLOCKS - 1; k <= CITY_BLOCKS; k++) roads.push((k + 0.5) * BLOCK_PITCH);
    const nearCrossing = (value: number) => roads.some((road) => Math.abs(value - road) < clear);
    for (const road of roads) {
      if (Math.abs(road) > reach) continue;
      for (let s = -reach; s <= reach; s += 1.5) {
        if (nearCrossing(s)) continue;
        dashes.push([road, 0.006, s, 0.08, 0.012, 0.7]);
        dashes.push([s, 0.006, road, 0.7, 0.012, 0.08]);
      }
    }
    const offset = ROAD_WIDTH / 2 + 0.5;
    for (const x of roads)
      for (const z of roads) {
        if (Math.abs(x) > 36 || Math.abs(z) > 36) continue;
        for (let s = 0; s < 6; s++) {
          const across = -0.9 + s * 0.36;
          stripes.push([x + across, 0.006, z - offset, 0.18, 0.012, 0.7]);
          stripes.push([x + across, 0.006, z + offset, 0.18, 0.012, 0.7]);
          stripes.push([x - offset, 0.006, z + across, 0.7, 0.012, 0.18]);
          stripes.push([x + offset, 0.006, z + across, 0.7, 0.012, 0.18]);
        }
      }
    const paint = this.resources.material('#dbe7df');
    this.batch(this.resources.cube, paint, dashes, undefined, false);
    this.batch(this.resources.cube, paint, stripes, undefined, false);
  }

  private buildLamps() {
    const posts: Box[] = [],
      heads: Box[] = [],
      pools: Box[] = [];
    const inset = LOT_HALF - 0.3;
    this.blocks(5, (i, j) => {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const x = i * BLOCK_PITCH + sx * inset,
            z = j * BLOCK_PITCH + sz * inset;
          posts.push([x, SIDEWALK_HEIGHT + 0.58, z, 0.07, 1.16, 0.07]);
          heads.push([x, SIDEWALK_HEIGHT + 1.2, z, 0.2, 0.1, 0.2]);
          pools.push([x, SIDEWALK_HEIGHT + 0.012, z, 2.6, 2.6, 1]);
        }
    });
    this.batch(this.resources.cube, this.resources.material('#4c6972'), posts);
    this.batch(this.resources.cube, this.lampHeads, heads, undefined, false);
    const poolMesh = new InstancedMesh(this.plane, this.poolMaterial, pools.length);
    pools.forEach(([x, y, z, w, h], index) => {
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.set(w, h, 1);
      this.dummy.updateMatrix();
      poolMesh.setMatrixAt(index, this.dummy.matrix);
    });
    poolMesh.renderOrder = 2;
    this.root.add(poolMesh);
    this.meshes.push(poolMesh);
  }

  private buildTrees(random: () => number) {
    const spots: [number, number, number][] = [];
    const add = (i: number, j: number, x: number, z: number) =>
      spots.push([i * BLOCK_PITCH + x, j * BLOCK_PITCH + z, blockKey(i, j)]);
    this.blocks(6, (i, j) => {
      if (isParkBlock(i, j)) {
        for (let n = 0; n < 9; n++)
          add(
            i,
            j,
            -2.2 + (n % 3) * 2.2 + (random() - 0.5) * 0.8,
            -2.2 + Math.floor(n / 3) * 2.2 + (random() - 0.5) * 0.8,
          );
      } else if (isDistrictBlock(i, j)) {
        // Flank the front plaza without touching the building or the visitor queue.
        for (const sx of [-1, 1]) for (const z of [-1.8, 1.5]) add(i, j, sx * (LOT_HALF - 0.6), z);
      } else if (Math.max(Math.abs(i), Math.abs(j)) >= 3) {
        // Nearer lots keep their sidewalks clear for pedestrians.
        for (const x of [-1.8, 1.8]) if (random() < 0.6) add(i, j, x, LOT_HALF - 0.4);
      }
    });
    const trunks = this.tint(this.resources.cube, this.resources.material('#ffffff'), spots.length);
    const crowns = this.tint(this.foliage, this.resources.material('#ffffff'), spots.length);
    const greens = ['#7fae78', '#6f9f6c', '#8cbf7a', '#78a870'];
    for (const [x, z, key] of spots) {
      const scale = 0.8 + random() * 0.45;
      trunks.add(
        this.matrix([x, SIDEWALK_HEIGHT + 0.24 * scale, z, 0.1, 0.48 * scale, 0.1]),
        this.scratch.set('#7a5a45'),
        key,
      );
      crowns.add(
        this.matrix(
          [x, SIDEWALK_HEIGHT + 0.78 * scale, z, 0.42 * scale, 0.46 * scale, 0.42 * scale],
          random() * Math.PI,
        ),
        this.scratch.set(greens[Math.floor(random() * greens.length)]),
        key,
      );
    }
  }

  /** Grays lots, parks, and trees outside the focused block. */
  applyEmphasis(emphasisForKey: (key: number) => number) {
    this.tinted.forEach((batch) => batch.applyEmphasis(emphasisForKey));
  }
  setNight(value: number) {
    this.lampHeads.emissiveIntensity = 0.25 + value * 3.4;
    this.litWindows.emissiveIntensity = 0.05 + value * 1.45;
    this.poolStrength.value = value * 0.55;
  }
  dispose() {
    this.meshes.forEach((mesh) => mesh.dispose());
    this.tinted.forEach((batch) => batch.dispose());
    this.foliage.dispose();
    this.plane.dispose();
    this.lampHeads.dispose();
    this.litWindows.dispose();
    this.poolMaterial.dispose();
    this.resources.dispose();
  }
}
