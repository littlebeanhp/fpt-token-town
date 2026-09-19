import { Group, Mesh } from 'three/webgpu';
import type { StopDefinition } from '@/types/factory';
import { Resources } from '../core/Resources';
import { AssetBase } from '../loaders/AssetBase';

/** The central FPT token router. It is the default camera stop and shares the asset contract. */
export class Core extends AssetBase {
  private readonly rings: Mesh[] = [];
  private resources = new Resources();
  constructor(definition: StopDefinition) {
    super(new Group());
    this.root.name = 'ROOT';
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
    this.rings[0].rotation.y = Math.sin(time * 0.5) * 0.2;
    this.rings[1].rotation.y = -time * 0.16;
  }
  dispose() {
    this.resources.dispose();
  }
}
