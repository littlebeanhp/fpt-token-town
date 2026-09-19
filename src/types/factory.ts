import type { Group, Object3D, Vector3 } from 'three/webgpu';

export type FactoryId = 'deepseek' | 'glm' | 'qwen' | 'minimax' | 'llama' | 'gpt-oss';
export type AnchorName =
  'CameraAnchor' | 'CameraTarget' | 'TokenInput' | 'TokenOutput' | 'UIAnchor';
export interface ModelDefinition {
  id: FactoryId;
  name: string;
  category: string;
  description: string;
  color: string;
  position: [number, number, number];
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
export interface ExperienceCallbacks {
  onSelect: (id: FactoryId | null) => void;
  onReady: (backend: string) => void;
  onError: (message: string) => void;
}
