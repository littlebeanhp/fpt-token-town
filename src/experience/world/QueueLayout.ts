import { blockKeyAt } from './layout';

export interface QueueSite {
  x: number;
  z: number;
  /** World z of the front edge of the building's plinth. */
  front: number;
  color: string;
}
export interface QueuePoint {
  x: number;
  z: number;
}
export interface QueueLayout {
  key: number;
  /** From the house entrance to the open sidewalk entrance at the back of the line. */
  path: QueuePoint[];
  rails: [QueuePoint, QueuePoint][];
  length: number;
}

/** Dense enough to read as a busy line while leaving a small gap between enlarged visitors. */
export const QUEUE_SPACING = 0.34;
export const QUEUE_ARRIVAL_DISTANCE = 0.9;
export const QUEUE_INSIDE_DISTANCE = 0.55;
/** One queue exchange happens every half-second: one person enters and one runner returns. */
export const QUEUE_STEP_SECONDS = 0.5;
/** Fixed number of people running around each building before they rejoin its queue. */
export const RUNNERS_PER_QUEUE = 10;

export function queueSlotCount(layout: QueueLayout) {
  return Math.floor((layout.length + QUEUE_ARRIVAL_DISTANCE) / QUEUE_SPACING);
}

/** Track 0 is the doorway, followed by queue slots, then the fixed runner circuit. */
export function queueTrackIndex(person: number, elapsed: number, slots: number) {
  const total = slots + RUNNERS_PER_QUEUE;
  return ((person - Math.floor(elapsed / QUEUE_STEP_SECONDS)) % total + total) % total;
}

/** One compact serpentine queue. People and rope barriers use this same layout. */
export function createQueueLayout(site: QueueSite): QueueLayout {
  const point = (x: number, z: number) => ({ x: site.x + x, z: site.front + z });
  const path = [
    point(0, 0.04),
    point(0, 0.4),
    point(-1.72, 0.4),
    point(-1.72, 0.96),
    point(1.72, 0.96),
    point(1.72, 1.52),
    point(-1.72, 1.52),
    point(-2.35, 1.52),
  ];
  const rails: [QueuePoint, QueuePoint][] = [
    // A gap at the front leads to the house. Alternating end gaps join the three rows.
    [point(-1.96, 0.12), point(-0.3, 0.12)],
    [point(0.3, 0.12), point(1.96, 0.12)],
    [point(-1.4, 0.68), point(1.96, 0.68)],
    [point(-1.96, 1.24), point(1.4, 1.24)],
    [point(-1.96, 1.8), point(1.96, 1.8)],
    [point(1.96, 0.12), point(1.96, 1.8)],
    // Leave the last row open on the left for arriving visitors.
    [point(-1.96, 0.12), point(-1.96, 1.24)],
  ];
  let length = 0;
  for (let i = 1; i < path.length; i++)
    length += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return { key: blockKeyAt(site.x, site.z), path, rails, length };
}

/** Distance back from the door, facing the person ahead in the queue. */
export function sampleQueue(
  layout: QueueLayout,
  distance: number,
  out: QueuePoint & { heading: number },
) {
  let remaining = Math.max(0, Math.min(layout.length, distance));
  for (let i = 1; i < layout.path.length; i++) {
    const a = layout.path[i - 1],
      b = layout.path[i];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (remaining <= length || i === layout.path.length - 1) {
      const t = remaining / length;
      out.x = a.x + dx * t;
      out.z = a.z + dz * t;
      out.heading = Math.atan2(-dx, -dz);
      return out;
    }
    remaining -= length;
  }
  return out;
}

/**
 * A continuous visitor loop. People approach the open back of the queue, follow every turn,
 * then pass through the front doorway before reappearing as a new arrival.
 */
export function sampleQueueFlow(
  layout: QueueLayout,
  travelled: number,
  out: QueuePoint & { heading: number },
) {
  const cycle = layout.length + QUEUE_ARRIVAL_DISTANCE + QUEUE_INSIDE_DISTANCE;
  const phase = ((travelled % cycle) + cycle) % cycle;
  const distance = layout.length + QUEUE_ARRIVAL_DISTANCE - phase;
  if (distance >= 0 && distance <= layout.length) return sampleQueue(layout, distance, out);

  if (distance > layout.length) {
    const b = layout.path.at(-1)!,
      a = layout.path.at(-2)!;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz),
      extra = distance - layout.length;
    out.x = b.x + (dx / length) * extra;
    out.z = b.z + (dz / length) * extra;
    out.heading = Math.atan2(-dx, -dz);
    return out;
  }

  const front = layout.path[0],
    next = layout.path[1],
    dx = next.x - front.x,
    dz = next.z - front.z,
    length = Math.hypot(dx, dz);
  out.x = front.x + (dx / length) * distance;
  out.z = front.z + (dz / length) * distance;
  out.heading = Math.atan2(-dx, -dz);
  return out;
}
