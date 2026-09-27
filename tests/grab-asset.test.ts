import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const characters = [
  {
    label: 'Grab',
    path: 'public/models/grab-walk-v1.glb',
    body: (name: string) => name.includes('body'),
    left: (name: string) => name.includes('left'),
    right: (name: string) => name.includes('right'),
  },
  {
    label: 'FPT',
    path: 'public/models/fpt-walk-v1.glb',
    body: (name: string) => name === 'textured_mesh.obj',
    left: (name: string) => name === 'textured_mesh.obj.001',
    right: (name: string) => name === 'textured_mesh.obj.002',
  },
];

for (const character of characters)
  test(`the web ${character.label} asset keeps split legs and its walk animation`, () => {
    const file = readFileSync(character.path);
    assert.equal(file.toString('ascii', 0, 4), 'glTF');
    const jsonLength = file.readUInt32LE(12),
      jsonType = file.readUInt32LE(16);
    assert.equal(jsonType, 0x4e4f534a, 'first GLB chunk is JSON');
    const gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength).trimEnd());
    const names = gltf.nodes.map((node: { name?: string }) => node.name?.toLowerCase() ?? '');
    const left = names.findIndex(character.left),
      right = names.findIndex(character.right);
    assert.ok(names.some(character.body));
    assert.ok(left >= 0 && right >= 0, 'left and right legs remain separate nodes');
    const targets = gltf.animations[0].channels.map(
      (channel: { target: { node: number; path: string } }) => channel.target,
    );
    for (const node of [left, right]) {
      assert.ok(
        targets.some(
          (target: { node: number; path: string }) =>
            target.node === node && target.path === 'translation',
        ),
      );
      assert.ok(
        targets.some(
          (target: { node: number; path: string }) =>
            target.node === node && target.path === 'rotation',
        ),
      );
    }
    assert.ok(file.byteLength < 300_000, 'walking asset stays within its client download budget');
  });
