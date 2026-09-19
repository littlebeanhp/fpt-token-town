import type { Group, Object3D, Vector3 } from 'three/webgpu';

export type FactoryId = 'deepseek' | 'glm' | 'qwen' | 'minimax' | 'llama' | 'gpt-oss';
/** A camera stop in the locked city tour. The FPT Core is the home stop. */
export type StopId = 'core' | FactoryId;
export type AnchorName =
  'CameraAnchor' | 'CameraTarget' | 'TokenInput' | 'TokenOutput' | 'UIAnchor';
export interface StopDefinition {
  id: StopId;
  name: string;
  category: string;
  description: string;
  color: string;
  /** World position of the building origin; its city block is derived from x/z. */
  position: [number, number, number];
}
export interface ModelDefinition extends StopDefinition {
  id: FactoryId;
  context: string;
  assetUrl?: string;
}
/** All positions are world-space. Implementations own and dispose their resources. */
export interface FactoryAsset {
  readonly root: Group;
  readonly colliders: Object3D[];
  getAnchor(name: AnchorName, target: Vector3): Vector3;
  setEmphasis(value: number): void;
  setNight(value: number): void;
  dispose(): void;
}
export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';
export type DayPreset = 'day' | 'dusk' | 'night';
export interface ClockState {
  /** City time in hours, 0 to 24. */
  hours: number;
  phase: DayPhase;
  /** True when the city reads as night, used for the page theme. */
  night: boolean;
  paused: boolean;
  speed: number;
}
export interface ExperienceCallbacks {
  onSelect: (id: StopId) => void;
  onReady: (backend: string) => void;
  onError: (message: string) => void;
  onClock: (state: ClockState) => void;
}
