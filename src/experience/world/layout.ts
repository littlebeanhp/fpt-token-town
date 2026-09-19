/**
 * City grid shared by the city builder, crowds, camera tests, and focus emphasis.
 * Roads run between blocks; each block holds one raised sidewalk lot.
 */
export const BLOCK_PITCH = 10;
export const ROAD_WIDTH = 2.2;
export const LOT_SIZE = BLOCK_PITCH - ROAD_WIDTH;
export const LOT_HALF = LOT_SIZE / 2;
export const SIDEWALK_HEIGHT = 0.14;
/** Filler blocks extend this many blocks from the centre in every direction. */
export const CITY_BLOCKS = 9;
/** Half-width of the built-up city. Everything a locked shot can see lies inside it. */
export const CITY_EXTENT = (CITY_BLOCKS + 0.5) * BLOCK_PITCH;
/** The central 3x3 blocks hold the core, the six districts, and two parks. */
export const DISTRICT_RANGE = 1;
export const PARK_BLOCKS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
];

export const blockIndex = (coordinate: number) => Math.round(coordinate / BLOCK_PITCH);
export const blockKey = (i: number, j: number) => (i + 64) * 128 + (j + 64);
export const blockKeyAt = (x: number, z: number) => blockKey(blockIndex(x), blockIndex(z));
export const isDistrictBlock = (i: number, j: number) =>
  Math.abs(i) <= DISTRICT_RANGE && Math.abs(j) <= DISTRICT_RANGE;
export const isParkBlock = (i: number, j: number) =>
  PARK_BLOCKS.some(([pi, pj]) => pi === i && pj === j);

/** Small deterministic PRNG so the city is identical on every load and in tests. */
export function createRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
