import { Group, Mesh, Texture } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ModelDefinition } from '@/types/factory';
import { AssetBase } from './AssetBase';

export class GLTFFactoryAsset extends AssetBase {
  private constructor(root: Group, model: ModelDefinition) {
    super(root);
    this.prepare();
    root.position.set(...model.position);
  }
  static async load(model: ModelDefinition) {
    if (!model.assetUrl) throw new Error('A GLB URL is required.');
    const gltf = await new GLTFLoader().loadAsync(model.assetUrl);
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return new GLTFFactoryAsset(gltf.scene, model);
  }
  dispose() {
    const textures = new Set<Texture>();
    this.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        for (const value of Object.values(material))
          if (value instanceof Texture) textures.add(value);
        material.dispose();
      }
    });
    textures.forEach((texture) => texture.dispose());
  }
}
