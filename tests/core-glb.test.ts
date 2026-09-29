import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Ho Guom keeps windows separate from the textured building within the download budget', () => {
  const bytes = readFileSync('public/models/ho-guom-v1.glb');
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const body = gltf.nodes.find((node: { name: string }) => node.name === 'textured_mesh.obj');
  const windows = gltf.nodes.find(
    (node: { name: string }) => node.name === 'textured_mesh.obj.001',
  );
  assert.ok(body && windows);
  assert.notEqual(body.mesh, windows.mesh, 'windows can receive emission independently');
  assert.ok(gltf.images.length > 0, 'authored textures are retained');
  assert.ok(bytes.length < 400_000);
});
