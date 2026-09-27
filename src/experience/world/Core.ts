import { Box3, Group, Mesh, MeshStandardMaterial, Vector3, type Texture } from 'three/webgpu';
import type { StopDefinition } from '@/types/factory';
import { Resources } from '../core/Resources';
import { AssetBase } from '../loaders/AssetBase';

/** The central FPT token router. It is the default camera stop and shares the asset contract. */
export class Core extends AssetBase {
  static async create(definition: StopDefinition) {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync('/models/ho-guom-v1.glb');
    const visual = gltf.scene;
    visual.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(visual);
    const size = bounds.getSize(new Vector3());
    const scale = Math.min(5 / size.x, 4.6 / size.z, 5.3 / size.y);
    visual.scale.setScalar(scale);
    visual.position.set(
      (-(bounds.min.x + bounds.max.x) * scale) / 2,
      0.14 - bounds.min.y * scale,
      (-(bounds.min.z + bounds.max.z) * scale) / 2,
    );
    let windows = 0;
    visual.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const isWindow = mesh.name.toLowerCase().replace(/[^a-z0-9]/g, '') === 'texturedmeshobj001';
      if (isWindow) windows++;
      const convert = (input: import('three/webgpu').Material) => {
        const source = input as MeshStandardMaterial;
        const material = new MeshStandardMaterial({
          color: source.color,
          map: source.map,
          normalMap: source.normalMap,
          roughnessMap: source.roughnessMap,
          metalnessMap: source.metalnessMap,
          roughness: source.roughness,
          metalness: source.metalness,
          side: source.side,
          vertexColors: source.vertexColors,
        });
        if (isWindow) {
          material.emissive.set('#ffcf80');
          material.emissiveIntensity = 3;
        }
        return material;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(convert)
        : convert(mesh.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    if (!windows) throw new Error('Ho Guom window mesh textured_mesh.obj.001 is missing');
    visual.name = 'VISUAL';
    return new Core(definition, visual);
  }
  private authored = false;
  private readonly rings: Mesh[] = [];
  private resources = new Resources();
  constructor(definition: StopDefinition, authored?: Group) {
    super(new Group());
    this.root.name = 'ROOT';
    if (authored) {
      this.authored = true;
      this.root.add(authored);
      this.prepare();
      this.root.position.set(...definition.position);
      this.root.updateMatrixWorld(true);
      return;
    }
    const visual = new Group();
    visual.name = 'VISUAL';
    this.root.add(visual);
    const r = this.resources,
      white = r.material('#eff6f3'),
      orange = r.material('#f47836'),
      dark = r.material('#2e5058'),
      light = r.material('#ff9a52', true);
    r.block(visual, [0, 0.2, 0], [5, 0.4, 4.6], dark);
    r.block(visual, [0, 0.5, 0], [4.5, 0.25, 4.1], white);
    r.block(visual, [0, 1.1, 0], [3.2, 1, 2.8], dark);
    r.block(visual, [0, 1.75, 0], [3.8, 0.35, 3.3], orange);
    r.block(visual, [0, 2.5, 0], [2.7, 1.2, 2.4], white);
    r.block(visual, [0, 3.3, 0], [3.3, 0.4, 3], orange);
    r.block(visual, [0, 3.8, 0], [1.6, 0.6, 1.5], dark);
    const crown = r.block(visual, [0, 4.65, 0], [1.25, 1.25, 1.25], light);
    crown.rotation.y = Math.PI / 4;
    for (const x of [-1, 0, 1]) {
      r.block(visual, [x, 2.5, 1.23], [0.48, 0.72, 0.07], dark);
      r.block(visual, [x, 2.5, 1.3], [0.29, 0.48, 0.04], light);
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      r.block(visual, [Math.cos(angle) * 2.25, 0.8, Math.sin(angle) * 2], [0.6, 0.6, 0.6], light);
    }
    for (let i = 0; i < 2; i++) {
      const ring = new Mesh(r.ring, light);
      ring.scale.setScalar(1.8 + i * 0.4);
      ring.position.y = 4.6;
      ring.rotation.x = Math.PI / 2 + i * 0.25;
      visual.add(ring);
      this.rings.push(ring);
    }
    this.prepare();
    this.root.position.set(...definition.position);
    this.root.updateMatrixWorld(true);
  }
  update(time: number) {
    if (this.authored) return;
    this.rings[0].rotation.y = Math.sin(time * 0.5) * 0.2;
    this.rings[1].rotation.y = -time * 0.16;
  }
  dispose() {
    if (this.authored) {
      const textures = new Set<Texture>();
      this.root.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
          material.dispose();
        }
      });
      textures.forEach((texture) => texture.dispose());
    }
    this.resources.dispose();
  }
}
