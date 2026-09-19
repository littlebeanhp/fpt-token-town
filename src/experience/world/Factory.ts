import type { FactoryAsset, ModelDefinition } from '@/types/factory';
import { PrimitiveFactoryAsset } from '../loaders/PrimitiveFactoryAsset';
import { GLTFFactoryAsset } from '../loaders/GLTFFactoryAsset';

export class Factory {
  private constructor(
    readonly model: ModelDefinition,
    readonly asset: FactoryAsset,
  ) {}
  static async create(model: ModelDefinition) {
    const asset = model.assetUrl
      ? await GLTFFactoryAsset.load(model)
      : new PrimitiveFactoryAsset(model);
    return new Factory(model, asset);
  }
  dispose() {
    this.asset.dispose();
  }
}
