import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  Vector3,
} from 'three/webgpu';
import { models } from '../src/data/models';
import { PrimitiveFactoryAsset } from '../src/experience/loaders/PrimitiveFactoryAsset';
import { AssetBase } from '../src/experience/loaders/AssetBase';
import { CameraRig } from '../src/experience/camera/CameraRig';
import type { AnchorName } from '../src/types/factory';

const anchors: AnchorName[] = [
  'CameraAnchor',
  'CameraTarget',
  'TokenInput',
  'TokenOutput',
  'UIAnchor',
];

test('every primitive exposes world-space anchors and raycastable geometry', () => {
  for (const model of models) {
    const asset = new PrimitiveFactoryAsset(model);
    asset.root.updateMatrixWorld(true);
    assert.ok(asset.colliders.length > 0);
    for (const name of anchors)
      assert.ok(asset.getAnchor(name, new Vector3()).toArray().every(Number.isFinite));
    const target = asset.getAnchor('CameraTarget', new Vector3());
    const position = asset.getAnchor('CameraAnchor', new Vector3());
    const ray = new Raycaster(position, target.clone().sub(position).normalize());
    assert.ok(
      ray.intersectObjects(asset.colliders, false).length > 0,
      `${model.id} can be selected from its shot`,
    );
    assert.equal(asset.getAnchor('TokenInput', new Vector3()).x, model.position[0] - 2.3);
    asset.dispose();
  }
});

test('focus changes material color without altering opacity or another factory', () => {
  const first = new PrimitiveFactoryAsset(models[0]),
    second = new PrimitiveFactoryAsset(models[0]);
  const materials = (root: Group) => {
    const result: MeshStandardMaterial[] = [];
    root.traverse((node) => {
      if (node instanceof Mesh && node.material instanceof MeshStandardMaterial)
        result.push(node.material);
    });
    return result;
  };
  const a = materials(first.root),
    b = materials(second.root);
  const original = a[0].color.clone();
  first.setEmphasis(0.25);
  first.setNight(1);
  assert.notDeepEqual(a[0].color, original);
  assert.deepEqual(b[0].color, original);
  assert.ok(a.every((material) => material.opacity === 1 && !material.transparent));
  first.setEmphasis(1);
  assert.deepEqual(a[0].color, original);
  first.dispose();
  second.dispose();
});

class FixtureAsset extends AssetBase {
  constructor(root: Group) {
    super(root);
    this.prepare();
  }
  dispose() {}
}
test('authored anchors survive and missing GLB anchors receive usable fallbacks', () => {
  const root = new Group(),
    visual = new Group();
  visual.name = 'VISUAL';
  const material = new MeshStandardMaterial();
  const geometry = new BoxGeometry(4, 3, 3);
  visual.add(new Mesh(geometry, material));
  root.add(visual);
  const authored = new Object3D();
  authored.name = 'CameraAnchor';
  authored.position.set(7, 8, 10);
  root.add(authored);
  const asset = new FixtureAsset(root);
  root.position.set(10, 0, -4);
  root.updateMatrixWorld(true);
  assert.deepEqual(asset.getAnchor('CameraAnchor', new Vector3()).toArray(), [17, 8, 6]);
  for (const name of anchors)
    assert.ok(asset.getAnchor(name, new Vector3()).toArray().every(Number.isFinite));
  assert.equal(asset.colliders.length, 1);
  geometry.dispose();
  material.dispose();
});

test('hidden collider nodes remain raycastable', () => {
  const root = new Group(),
    mesh = new Mesh(new BoxGeometry(3, 3, 3), new MeshStandardMaterial());
  mesh.name = 'COLLIDER';
  root.add(mesh);
  const asset = new FixtureAsset(root);
  root.updateMatrixWorld(true);
  assert.equal(mesh.visible, false);
  assert.equal(
    new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1)).intersectObjects(asset.colliders)
      .length > 0,
    true,
  );
  mesh.geometry.dispose();
  (mesh.material as MeshStandardMaterial).dispose();
});

test('camera clamps overview and focus orbits, disables pan, and restores overview', () => {
  Object.defineProperty(globalThis, 'matchMedia', {
    value: () => ({ matches: true }),
    configurable: true,
  });
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    style: {},
    dataset: {},
    ownerDocument: document,
    getRootNode: () => document,
  }) as unknown as HTMLCanvasElement;
  const rig = new CameraRig(canvas);
  rig.resize(1440, 700);
  assert.equal(rig.controls.enablePan, false);
  const degrees = (radians: number) => (radians * 180) / Math.PI;
  assert.ok(Math.abs(degrees(rig.controls.maxAzimuthAngle) - 35) < 0.001);
  rig.camera.position.set(-90, 1, -90);
  rig.controls.update();
  assert.ok(degrees(rig.controls.getAzimuthalAngle()) >= -35.001);
  assert.ok(degrees(rig.controls.getPolarAngle()) >= 42.99);
  const factory = new PrimitiveFactoryAsset(models[1]);
  factory.root.updateMatrixWorld(true);
  rig.focus(factory, true);
  assert.ok(
    Math.abs(degrees(rig.controls.maxAzimuthAngle - rig.controls.minAzimuthAngle) - 24) < 0.001,
  );
  assert.ok(rig.controls.minDistance > 0);
  rig.focus(null, true);
  assert.ok(Math.abs(degrees(rig.controls.maxAzimuthAngle) - 35) < 0.001);
  factory.dispose();
  rig.dispose();
});
