import {
  BoxGeometry,
  Color,
  Euler,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import { TintedInstances } from '../core/TintedInstances';
import {
  BLOCK_PITCH,
  LOT_HALF,
  SIDEWALK_HEIGHT,
  blockIndex,
  blockKey,
  createRandom,
  isDistrictBlock,
} from './layout';

export interface CrowdSite {
  /** Building origin in world space. */
  x: number;
  z: number;
  /** World z of the building's front face; the queue forms in front of it. */
  front: number;
  color: string;
}

interface Person {
  x: number;
  z: number;
  heading: number;
  phase: number;
  scale: number;
  /** Walkers loop a lot perimeter; standing people idle in place. */
  walker: boolean;
  centerX: number;
  centerZ: number;
  start: number;
  speed: number;
  index: number;
  /** Some visitors wear their district's brand color. */
  brand?: string;
}

const SHIRTS = [
  '#e05d5d',
  '#4f7cc9',
  '#f2c14e',
  '#57a773',
  '#9b6fd1',
  '#f08a4b',
  '#3d5a80',
  '#e8e8e8',
  '#34343c',
  '#d97aa6',
  '#6cc4c4',
];
const PANTS = ['#2f3b52', '#4a4a4a', '#6b5b45', '#1f2a44', '#8a7a66', '#354f52'];
const SKIN = ['#f1c9a5', '#e0ac7e', '#c68642', '#8d5524', '#ffdbac', '#a86b3c'];
const HAIR = ['#2b1d14', '#4a3021', '#1b1b1b', '#8b5a2b', '#d8b45a', '#9a9a9a'];
const WALK_HALF = LOT_HALF - 0.6;
const WALK_PERIMETER = WALK_HALF * 8;

/**
 * Voxel visitors: a queue in front of every district, idle loiterers, and pedestrians looping
 * nearby lots. Four instanced batches (legs, torso, head, hair) render every person.
 */
export class Crowd {
  readonly root = new Group();
  private geometry = new BoxGeometry(1, 1, 1);
  private material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  private legs: TintedInstances;
  private torsos: TintedInstances;
  private heads: TintedInstances;
  private hair: TintedInstances;
  private people: Person[] = [];
  private matrix = new Matrix4();
  private position = new Vector3();
  private scale = new Vector3();
  private rotation = new Quaternion();
  private euler = new Euler(0, 0, 0, 'YXZ');
  private color = new Color();

  constructor(sites: CrowdSite[]) {
    const random = createRandom(7331);
    for (const site of sites) this.spawnSite(site, random);
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) {
        if (isDistrictBlock(i, j) && !(Math.abs(i) === 1 && j === 0)) continue;
        for (let n = 0; n < 4; n++) this.spawnWalker(i, j, random);
      }
    const count = this.people.length;
    this.legs = new TintedInstances(this.geometry, this.material, count * 2, true);
    this.torsos = new TintedInstances(this.geometry, this.material, count, true);
    this.heads = new TintedInstances(this.geometry, this.material, count, true);
    this.hair = new TintedInstances(this.geometry, this.material, count, true);
    this.root.add(this.legs.mesh, this.torsos.mesh, this.heads.mesh, this.hair.mesh);
    const pick = (list: string[]) => this.color.set(list[Math.floor(random() * list.length)]);
    for (const person of this.people) {
      const key = blockKey(blockIndex(person.x), blockIndex(person.z));
      const pants = pick(PANTS).clone();
      this.legs.add(this.matrix, pants, key);
      this.legs.add(this.matrix, pants, key);
      this.torsos.add(this.matrix, person.brand ? this.color.set(person.brand) : pick(SHIRTS), key);
      this.heads.add(this.matrix, pick(SKIN), key);
      this.hair.add(this.matrix, pick(HAIR), key);
    }
    this.update(0);
  }

  private spawn(
    values: Partial<Person> & Pick<Person, 'x' | 'z' | 'heading'>,
    random: () => number,
  ) {
    const person: Person = {
      phase: random() * Math.PI * 2,
      scale: 0.9 + random() * 0.2,
      walker: false,
      centerX: 0,
      centerZ: 0,
      start: 0,
      speed: 0,
      index: this.people.length,
      ...values,
    };
    this.people.push(person);
    return person;
  }
  private spawnSite(site: CrowdSite, random: () => number) {
    const lotZ = blockIndex(site.z) * BLOCK_PITCH;
    const lotX = blockIndex(site.x) * BLOCK_PITCH;
    const queue = 16 + Math.floor(random() * 12);
    const columns = 9;
    for (let n = 0; n < queue; n++) {
      const row = Math.floor(n / columns);
      const column = n % columns;
      const slot = row % 2 === 0 ? column : columns - 1 - column;
      const person = this.spawn(
        {
          x: site.x - 1.7 + slot * 0.42 + (random() - 0.5) * 0.08,
          z: site.front + 0.42 + row * 0.46 + (random() - 0.5) * 0.08,
          heading: Math.PI + (random() - 0.5) * 0.7,
        },
        random,
      );
      if (random() < 0.3) person.brand = site.color;
    }
    for (let n = 0; n < 5; n++)
      this.spawn(
        {
          x: lotX + (random() - 0.5) * (LOT_HALF * 2 - 0.8),
          z: lotZ + LOT_HALF - 0.45 - random() * 0.35,
          heading: random() * Math.PI * 2,
        },
        random,
      );
  }
  private spawnWalker(i: number, j: number, random: () => number) {
    this.spawn(
      {
        x: i * BLOCK_PITCH,
        z: j * BLOCK_PITCH + WALK_HALF,
        heading: 0,
        walker: true,
        centerX: i * BLOCK_PITCH,
        centerZ: j * BLOCK_PITCH,
        start: random() * WALK_PERIMETER,
        speed: (0.35 + random() * 0.3) * (random() < 0.5 ? -1 : 1),
      },
      random,
    );
  }

  private walk(person: Person, elapsed: number) {
    const s = WALK_HALF;
    const u =
      (((person.start + elapsed * person.speed) % WALK_PERIMETER) + WALK_PERIMETER) %
      WALK_PERIMETER;
    const segment = Math.floor(u / (2 * s)),
      t = u - segment * 2 * s;
    let dx = 0,
      dz = 0;
    if (segment === 0) {
      person.x = person.centerX - s + t;
      person.z = person.centerZ + s;
      dx = 1;
    } else if (segment === 1) {
      person.x = person.centerX + s;
      person.z = person.centerZ + s - t;
      dz = -1;
    } else if (segment === 2) {
      person.x = person.centerX + s - t;
      person.z = person.centerZ - s;
      dx = -1;
    } else {
      person.x = person.centerX - s;
      person.z = person.centerZ - s + t;
      dz = 1;
    }
    const direction = Math.sign(person.speed);
    person.heading = Math.atan2(dx * direction, dz * direction);
  }

  /** Writes one body part: a local offset from the person's feet, rotated by their heading. */
  private compose(
    target: TintedInstances,
    index: number,
    person: Person,
    heading: number,
    tilt: number,
    ox: number,
    oy: number,
    oz: number,
    w: number,
    h: number,
    d: number,
  ) {
    const cos = Math.cos(heading),
      sin = Math.sin(heading);
    this.euler.set(tilt, heading, 0);
    this.rotation.setFromEuler(this.euler);
    this.position.set(
      person.x + ox * cos + oz * sin,
      SIDEWALK_HEIGHT + oy,
      person.z - ox * sin + oz * cos,
    );
    this.matrix.compose(this.position, this.rotation, this.scale.set(w, h, d));
    target.setMatrix(index, this.matrix);
  }
  private composeLeg(person: Person, heading: number, side: number, swing: number) {
    const k = person.scale,
      length = 0.2 * k,
      angle = swing * side;
    this.compose(
      this.legs,
      person.index * 2 + (side + 1) / 2,
      person,
      heading,
      angle,
      side * 0.045 * k,
      length - (length / 2) * Math.cos(angle),
      -(length / 2) * Math.sin(angle),
      0.075 * k,
      length,
      0.09 * k,
    );
  }

  update(elapsed: number) {
    for (const person of this.people) {
      if (person.walker) this.walk(person, elapsed);
      const k = person.scale;
      const cycle = elapsed * (person.walker ? 7.5 : 2.2) + person.phase;
      const swing = person.walker ? Math.sin(cycle) * 0.55 : 0;
      const bob = person.walker
        ? Math.abs(Math.sin(cycle)) * 0.018 * k
        : Math.sin(cycle) * 0.006 * k;
      const heading =
        person.heading + (person.walker ? 0 : Math.sin(elapsed * 0.6 + person.phase) * 0.12);
      const hip = 0.2 * k + bob;
      this.composeLeg(person, heading, -1, swing);
      this.composeLeg(person, heading, 1, swing);
      this.compose(
        this.torsos,
        person.index,
        person,
        heading,
        0,
        0,
        hip + 0.1 * k,
        0,
        0.2 * k,
        0.2 * k,
        0.12 * k,
      );
      this.compose(
        this.heads,
        person.index,
        person,
        heading,
        0,
        0,
        hip + 0.275 * k,
        0,
        0.15 * k,
        0.15 * k,
        0.15 * k,
      );
      this.compose(
        this.hair,
        person.index,
        person,
        heading,
        0,
        0,
        hip + 0.37 * k,
        -0.01 * k,
        0.16 * k,
        0.05 * k,
        0.16 * k,
      );
    }
    this.legs.commitMatrices();
    this.torsos.commitMatrices();
    this.heads.commitMatrices();
    this.hair.commitMatrices();
  }
  applyEmphasis(emphasisForKey: (key: number) => number) {
    this.legs.applyEmphasis(emphasisForKey);
    this.torsos.applyEmphasis(emphasisForKey);
    this.heads.applyEmphasis(emphasisForKey);
    this.hair.applyEmphasis(emphasisForKey);
  }
  get size() {
    return this.people.length;
  }
  dispose() {
    this.legs.dispose();
    this.torsos.dispose();
    this.heads.dispose();
    this.hair.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
