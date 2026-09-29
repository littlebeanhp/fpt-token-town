// Shrink a Hunyuan3D export for the web, then drop it in public/models/.
//
//   node scripts/optimize-glb.mjs <input.glb> <name> [preset]
//   node scripts/optimize-glb.mjs ~/raw/deepseek.glb deepseek city
//
// Presets trade triangles for bytes. Buildings sit on a 10-unit grid and are never seen
// close up, so `city` (the default) is the right one; `hero` keeps full density for a model
// the camera actually approaches.
//
// Compression is deliberately limited to KHR_mesh_quantization + EXT_texture_webp, because
// three.js GLTFLoader decodes both on its own. Draco and Meshopt compress harder but each
// needs a decoder registered in GLTFFactoryAsset.ts plus a wasm payload, which costs more
// than it saves at this asset size.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const PRESETS = {
  hero: { size: 1024, ratio: 1, error: 0.0001 },
  city: { size: 512, ratio: 0.25, error: 0.002 },
  distant: { size: 256, ratio: 0.12, error: 0.005 },
};

const [input, name, preset = 'city'] = process.argv.slice(2);
if (!input || !name) {
  console.error('usage: node scripts/optimize-glb.mjs <input.glb> <name> [hero|city|distant]');
  process.exit(1);
}
const tune = PRESETS[preset];
if (!tune) {
  console.error(`unknown preset ${preset}; expected one of ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}

mkdirSync('public/models', { recursive: true });
const output = resolve('public/models', `${name}.glb`);

execFileSync(
  'npx',
  [
    '--yes',
    '@gltf-transform/cli@4',
    'optimize',
    resolve(input),
    output,
    '--compress',
    'quantize',
    '--texture-size',
    String(tune.size),
    '--texture-compress',
    'webp',
    '--simplify',
    String(tune.ratio < 1),
    ...(tune.ratio < 1
      ? ['--simplify-ratio', String(tune.ratio), '--simplify-error', String(tune.error)]
      : []),
  ],
  { stdio: 'inherit' },
);

const before = statSync(resolve(input)).size;
const after = statSync(output).size;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(
  `\n${input} ${kb(before)} -> public/models/${name}.glb ${kb(after)} ` +
    `(-${(100 - (after / before) * 100).toFixed(0)}%, preset ${preset})`,
);
