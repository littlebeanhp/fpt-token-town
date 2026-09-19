import type { Group } from 'three/webgpu';

/** CPU and future compute implementations expose the same lifecycle. */
export interface TokenSimulation {
  readonly root: Group;
  update(delta: number, elapsed: number): void;
  setNight(value: number): void;
  dispose(): void;
}
