import { Box3, Color, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three/webgpu';
import type { AnchorName, FactoryAsset } from '@/types/factory';

export abstract class AssetBase implements FactoryAsset {
  readonly colliders: Object3D[] = [];
  protected anchors = new Map<AnchorName, Object3D>();
  protected surfaces: { material: MeshStandardMaterial; color: Color; emission: number }[] = [];
  protected emphasis = 1;
  protected night = 0;
  private grayColor = new Color();
  constructor(readonly root: Group) {}

  protected prepare() {
    this.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(this.root);
    const size = box.getSize(new Vector3());
    const height = Math.max(size.y, 2);
    const defaults: Record<AnchorName, [number, number, number]> = {
      CameraTarget: [0, height * 0.42, 0],
      CameraAnchor: [5, height * 0.42 + 7, 10],
      TokenInput: [-2.3, 0.65, 0],
      TokenOutput: [2.3, 0.65, 0],
      UIAnchor: [0, height + 0.8, 0],
    };
    for (const name of Object.keys(defaults) as AnchorName[]) {
      let anchor = this.root.getObjectByName(name);
      if (!anchor) {
        anchor = new Object3D();
        anchor.name = name;
        anchor.position.set(...defaults[name]);
        this.root.add(anchor);
      }
      this.anchors.set(name, anchor);
    }
    const collider = this.root.getObjectByName('COLLIDER');
    if (collider) {
      // Hidden collider geometry still participates in explicit raycasts.
      collider.visible = false;
      collider.traverse((node) => {
        if (node instanceof Mesh) this.colliders.push(node);
      });
    } else {
      (this.root.getObjectByName('VISUAL') ?? this.root).traverse((node) => {
        if (node instanceof Mesh) this.colliders.push(node);
      });
    }
    const seen = new Set<MeshStandardMaterial>();
    this.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material instanceof MeshStandardMaterial && !seen.has(material)) {
          seen.add(material);
          this.surfaces.push({
            material,
            color: material.color.clone(),
            emission: material.emissiveIntensity,
          });
        }
      }
    });
  }
  getAnchor(name: AnchorName, target: Vector3) {
    return this.anchors.get(name)!.getWorldPosition(target);
  }
  setEmphasis(value: number) {
    this.emphasis = value;
    this.applySurfaces();
  }
  setNight(value: number) {
    this.night = value;
    this.applySurfaces();
  }
  private applySurfaces() {
    for (const surface of this.surfaces) {
      surface.material.color.copy(surface.color);
      const gray = surface.color.r * 0.2126 + surface.color.g * 0.7152 + surface.color.b * 0.0722;
      surface.material.color
        .lerp(this.grayColor.setRGB(gray, gray, gray), (1 - this.emphasis) * 0.6)
        .multiplyScalar(0.58 + this.emphasis * 0.42);
      surface.material.emissiveIntensity =
        surface.emission * (0.55 + this.night * 2) * (0.5 + this.emphasis * 0.5);
    }
  }
  abstract dispose(): void;
}
