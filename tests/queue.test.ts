import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Color, InstancedMesh } from 'three/webgpu';
import { models } from '../src/data/models';
import { BACKGROUND_EMPHASIS } from '../src/experience/core/emphasis';
import { PrimitiveFactoryAsset } from '../src/experience/loaders/PrimitiveFactoryAsset';
import { QueueBarriers } from '../src/experience/world/QueueBarriers';
import {
  QUEUE_ARRIVAL_DISTANCE,
  QUEUE_INSIDE_DISTANCE,
  QUEUE_SPACING,
  QUEUE_STEP_SECONDS,
  RUNNERS_PER_QUEUE,
  createQueueLayout,
  queueSlotCount,
  queueTrackIndex,
  sampleQueue,
  sampleQueueFlow,
  type QueuePoint,
} from '../src/experience/world/QueueLayout';
import { BLOCK_PITCH, LOT_HALF, blockIndex } from '../src/experience/world/layout';

function sites() {
  return models.map((model) => {
    const asset = new PrimitiveFactoryAsset(model);
    const front = new Box3().setFromObject(asset.root).max.z;
    asset.dispose();
    return { x: model.position[0], z: model.position[2], front, color: model.color };
  });
}
function distanceToRail(p: QueuePoint, a: QueuePoint, b: QueuePoint) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

test('every model shop has a queue with clear doorway, turns and sidewalk entrance', () => {
  for (const site of sites()) {
    const layout = createQueueLayout(site);
    const centerZ = blockIndex(site.z) * BLOCK_PITCH;
    assert.ok(layout.length / QUEUE_SPACING > 30, 'the waiting line has over 30 dense slots');
    const pose = { x: 0, z: 0, heading: 0 };
    for (let distance = 0; distance <= layout.length; distance += 0.025) {
      sampleQueue(layout, distance, pose);
      for (const [a, b] of layout.rails)
        assert.ok(
          distanceToRail(pose, a, b) >= 0.2,
          'people can follow the queue without walking through a rope or post',
        );
      assert.ok(Math.abs(pose.x - site.x) < LOT_HALF - 0.2);
      assert.ok(Math.abs(pose.z - centerZ) < LOT_HALF - 0.2);
      assert.ok(pose.z > site.front, 'queue stays outside the building');
    }
    const barriers = new QueueBarriers([site]);
    const bounds = new Box3().setFromObject(barriers.root);
    assert.ok(bounds.max.z < centerZ + LOT_HALF);
    assert.ok(bounds.min.z > site.front);
    assert.ok(bounds.min.x > site.x - LOT_HALF && bounds.max.x < site.x + LOT_HALF);
    barriers.dispose();
  }
});

test('one person exchanges with a fixed runner every half-second', () => {
  const site = sites()[0],
    layout = createQueueLayout(site),
    slots = queueSlotCount(layout),
    total = slots + RUNNERS_PER_QUEUE,
    pose = { x: 0, z: 0, heading: 0 };
  sampleQueueFlow(layout, 0, pose);
  assert.ok(pose.x < layout.path.at(-1)!.x, 'a new visitor approaches the open line entrance');
  sampleQueueFlow(layout, QUEUE_ARRIVAL_DISTANCE + layout.length, pose);
  assert.ok(Math.abs(pose.x - site.x) < 0.001, 'the front visitor reaches the doorway');
  sampleQueueFlow(
    layout,
    QUEUE_ARRIVAL_DISTANCE + layout.length + QUEUE_INSIDE_DISTANCE * 0.5,
    pose,
  );
  assert.ok(pose.z < site.front, 'the visitor continues inside the model building');
  assert.equal(queueTrackIndex(0, QUEUE_STEP_SECONDS - 0.001, slots), 0);
  assert.equal(
    queueTrackIndex(0, QUEUE_STEP_SECONDS, slots),
    total - 1,
    'the front person immediately becomes the newest runner',
  );
  assert.equal(
    queueTrackIndex(slots, QUEUE_STEP_SECONDS, slots),
    slots - 1,
    'the oldest runner rejoins the back of the queue at the same event',
  );
  for (const time of [0, 0.5, 1.25, 4.8]) {
    let runners = 0;
    for (let person = 0; person < total; person++)
      if (queueTrackIndex(person, time, slots) >= slots) runners++;
    assert.equal(runners, RUNNERS_PER_QUEUE, 'runner count stays fixed around every building');
  }
  assert.equal(
    queueTrackIndex(3, total * QUEUE_STEP_SECONDS, slots),
    3,
    'each person runs around and returns instead of disappearing',
  );
});

test('red ropes use instanced rendering and gray with the unfocused shops', () => {
  const allSites = sites();
  const barriers = new QueueBarriers(allSites);
  assert.equal(barriers.root.children.length, 4, 'four shared batches for all six shops');
  const ropes = barriers.root.getObjectByName('queue-red-ropes') as InstancedMesh;
  const color = new Color();
  barriers.applyEmphasis(() => 1);
  for (let i = 0; i < ropes.count; i++) {
    ropes.getColorAt(i, color);
    assert.ok(color.r > color.g * 5, 'focused rope is red');
  }
  barriers.applyEmphasis(() => BACKGROUND_EMPHASIS);
  for (let i = 0; i < ropes.count; i++) {
    ropes.getColorAt(i, color);
    assert.equal(color.r, color.g);
    assert.equal(color.g, color.b);
  }
  let disposed = 0;
  for (const batch of barriers.root.children)
    (batch as InstancedMesh).addEventListener('dispose', () => disposed++);
  barriers.dispose();
  assert.equal(disposed, 4);
});
