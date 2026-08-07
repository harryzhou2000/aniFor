import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  FIRE_FLAME_VFX_AUDIT, prepareFireFlameVfxFixture,
  type FireFlameVfxFixtureMode, type FireFlameVfxPoint, type FireFlameVfxRect,
} from './fire-flame-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('Fire flame VFX audit fixture', () => {
  it('authors one connected Fire body with distinct thermal and topology evidence', () => {
    const simulation = prepared('moving');
    const { body, ambientTemperature } = FIRE_FLAME_VFX_AUDIT;

    const baseProbe = { x: body.base.x + 8, y: body.base.y + body.base.height - 8 };
    expect(cell(simulation, baseProbe)).toBe(Material.Fire);
    expect(temperature(simulation, baseProbe)).toBe(body.baseTemperature);
    expectRectState(simulation, body.hotCore, Material.Fire, body.hotCore.temperature);
    expectRectState(simulation, body.coolPocket, Material.Fire, body.coolPocket.temperature);
    expectRectState(
      simulation, body.straightNeutral, Material.Fire, body.straightNeutral.temperature,
    );

    const tongueTop = {
      x: body.velocityTongue.x + Math.floor(body.velocityTongue.width / 2),
      y: body.velocityTongue.y,
    };
    const tongueBottom = { x: tongueTop.x, y: body.velocityTongue.y + body.velocityTongue.height - 1 };
    expect(cell(simulation, tongueTop)).toBe(Material.Fire);
    expect(cell(simulation, tongueBottom)).toBe(Material.Fire);
    expect(temperature(simulation, tongueTop)).toBe(body.velocityTongue.temperature);
    expect(velocity(simulation, tongueTop)).toEqual([
      body.velocityTongue.velocity.x, body.velocityTongue.velocity.y,
    ]);
    for (const corner of [
      { x: body.velocityTongue.x, y: body.velocityTongue.y },
      { x: body.velocityTongue.x + body.velocityTongue.width - 1, y: body.velocityTongue.y },
    ]) {
      expect(cell(simulation, corner)).toBe(Material.Empty);
      expect(temperature(simulation, corner)).toBe(ambientTemperature);
      expect(velocity(simulation, corner)).toEqual([0, 0]);
    }

    expect(connectedFireCells(simulation, body.bounds, baseProbe))
      .toBe(countRect(simulation.cells(), body.bounds, Material.Fire));
    expect(countRect(simulation.cells(), body.bounds, Material.Fire))
      .toBe(FIRE_FLAME_VFX_AUDIT.expected.mainBodyFireCells);
    for (const cutout of [body.authoredHole, body.openChannel]) {
      expectRectState(simulation, cutout, Material.Empty, ambientTemperature);
      expect(velocity(simulation, centre(cutout))).toEqual([0, 0]);
    }
    expect(body.openChannel.y).toBe(body.base.y);
    expect(cell(simulation, { x: body.openChannel.x, y: body.openChannel.y - 1 }))
      .toBe(Material.Empty);
  });

  it('changes only documented exact-Fire velocity bytes between still and moving modes', () => {
    const moving = prepared('moving');
    const still = prepared('still');
    const fixture = FIRE_FLAME_VFX_AUDIT;

    expect(equalValues(moving.cells(), still.cells())).toBe(true);
    expect(equalValues(moving.temperature(), still.temperature())).toBe(true);
    expect(equalValues(moving.walls(), still.walls())).toBe(true);
    expect(still.velocity().some(Boolean)).toBe(false);
    expect(velocity(moving, centre(fixture.body.straightNeutral))).toEqual([0, 0]);

    let movingVelocityCells = 0;
    let invalidVelocityCells = 0;
    for (let index = 0; index < moving.cells().length; index++) {
      const velocityOffset = index * 2;
      const actual = [moving.velocity()[velocityOffset], moving.velocity()[velocityOffset + 1]];
      if (actual[0] === 0 && actual[1] === 0) continue;
      movingVelocityCells++;
      const point = { x: index % WIDTH, y: Math.floor(index / WIDTH) };
      if (moving.cells()[index] !== Material.Fire
        || !contains(fixture.body.velocityTongue, point)
        || actual[0] !== fixture.body.velocityTongue.velocity.x
        || actual[1] !== fixture.body.velocityTongue.velocity.y) invalidVelocityCells++;
    }
    expect(movingVelocityCells).toBe(fixture.expected.movingVelocityCells);
    expect(invalidVelocityCells).toBe(0);
    expect(hashBytePlane(still.velocity())).toBe(fixture.expected.stillVelocityHash);
    expect(hashBytePlane(moving.velocity())).toBe(fixture.expected.movingVelocityHash);
  });

  it('keeps sparse, foreign-owner, contact, wall, and blank controls exact', () => {
    const simulation = prepared('moving');
    const fixture = FIRE_FLAME_VFX_AUDIT;

    expectRectState(
      simulation, fixture.sparse.strand, Material.Fire, fixture.sparse.strand.temperature,
    );
    expect(cell(simulation, fixture.sparse.isolated)).toBe(Material.Fire);
    expect(temperature(simulation, fixture.sparse.isolated))
      .toBe(fixture.sparse.isolated.temperature);
    expect(velocity(simulation, centre(fixture.sparse.strand))).toEqual([0, 0]);
    expect(velocity(simulation, fixture.sparse.isolated)).toEqual([0, 0]);

    for (const control of Object.values(fixture.protectedControls)) {
      expectRectState(simulation, control.body, control.material, control.temperature);
      expect(cell(simulation, control.probe)).toBe(control.material);
      expect(velocity(simulation, control.probe)).toEqual([0, 0]);
    }
    for (const contact of Object.values(fixture.contacts)) {
      expectRectState(simulation, contact.fire, Material.Fire, contact.fireTemperature);
      expectRectState(
        simulation, contact.other, contact.otherMaterial, contact.otherTemperature,
      );
      expect(cell(simulation, contact.fireProbe)).toBe(Material.Fire);
      expect(cell(simulation, contact.otherProbe)).toBe(contact.otherMaterial);
      expect(velocity(simulation, contact.fireProbe)).toEqual([0, 0]);
      expect(velocity(simulation, contact.otherProbe)).toEqual([0, 0]);
    }

    let wallCells = 0;
    forEach(fixture.wallCoexistence.region, (point) => {
      const blockX = Math.floor((point.x - fixture.wallCoexistence.region.x) / 4);
      const blockY = Math.floor((point.y - fixture.wallCoexistence.region.y) / 4);
      const expectedWall = (blockX + blockY) % 2 === fixture.wallCoexistence.occupiedParity
        ? fixture.conductiveWall : 0;
      wallCells += Number(expectedWall !== 0);
      expect(simulation.walls()[point.y * WIDTH + point.x]).toBe(expectedWall);
      expect(cell(simulation, point)).toBe(Material.Fire);
      expect(temperature(simulation, point)).toBe(fixture.body.baseTemperature);
      expect(velocity(simulation, point)).toEqual([0, 0]);
    });
    expect(wallCells).toBe(fixture.expected.wallCells);
    expect(simulation.walls()[
      fixture.wallCoexistence.wallProbe.y * WIDTH + fixture.wallCoexistence.wallProbe.x
    ]).toBe(fixture.conductiveWall);
    expect(simulation.walls()[
      fixture.wallCoexistence.clearProbe.y * WIDTH + fixture.wallCoexistence.clearProbe.x
    ]).toBe(0);
    expectRectState(
      simulation, fixture.guardedBlank, Material.Empty, fixture.ambientTemperature,
    );
    forEach(fixture.guardedBlank, (point) => {
      expect(velocity(simulation, point)).toEqual([0, 0]);
      expect(simulation.walls()[point.y * WIDTH + point.x]).toBe(0);
    });
  });

  it('freezes counts and hashes and deterministically restores all RenderLab planes', () => {
    const first = prepared('moving');
    const second = prepared('moving');
    const fixture = FIRE_FLAME_VFX_AUDIT;
    const actual = {
      mainBodyFireCells: countRect(first.cells(), fixture.body.bounds, Material.Fire),
      fireCells: count(first.cells(), Material.Fire),
      energyCells: count(first.cells(), Material.ELEC),
      plasmaCells: count(first.cells(), Material.Plasma),
      lavaCells: count(first.cells(), Material.Lava),
      smokeCells: count(first.cells(), Material.Smoke),
      metalCells: count(first.cells(), Material.Metal),
      wallCells: count(first.walls(), fixture.conductiveWall),
      movingVelocityCells: countVelocityCells(first.velocity()),
      temperatureCounts: temperatureCounts(first.temperature()),
      materialHash: hashBytePlane(first.cells()),
      temperatureHash: hashUint16Plane(first.temperature()),
      wallHash: hashBytePlane(first.walls()),
      stillVelocityHash: hashBytePlane(prepared('still').velocity()),
      movingVelocityHash: hashBytePlane(first.velocity()),
    };
    expect(actual).toEqual(fixture.expected);

    expect(equalValues(first.cells(), second.cells())).toBe(true);
    expect(equalValues(first.temperature(), second.temperature())).toBe(true);
    expect(equalValues(first.velocity(), second.velocity())).toBe(true);
    expect(equalValues(first.walls(), second.walls())).toBe(true);
    expect(second.presentationState().some(Boolean)).toBe(false);
    expect(second.photonState().some(Boolean)).toBe(false);

    const cells = first.cells().slice();
    const temperatures = first.temperature().slice();
    const velocities = first.velocity().slice();
    const walls = first.walls().slice();
    first.cells().fill(Material.Water);
    first.setFixtureTemperatureRect(0, 0, WIDTH, HEIGHT, 0xffff);
    first.setFixtureVelocityRect(0, 0, WIDTH, HEIGHT, 127, -127);
    first.paintWall(4, 4, 2, 0);
    first.setFixturePresentationStateRect(0, 0, 8, 8, 0xffff);
    first.setFixturePhotonStateRect(0, 0, 8, 8, 0xffff);
    prepareFireFlameVfxFixture(first, 'moving');
    expect(equalValues(first.cells(), cells)).toBe(true);
    expect(equalValues(first.temperature(), temperatures)).toBe(true);
    expect(equalValues(first.velocity(), velocities)).toBe(true);
    expect(equalValues(first.walls(), walls)).toBe(true);
    expect(first.presentationState().some(Boolean)).toBe(false);
    expect(first.photonState().some(Boolean)).toBe(false);
  });

  it('rejects unsupported backends and noncanonical dimensions', () => {
    expect(() => prepareFireFlameVfxFixture(new RenderLabBackend(32, 32), 'still'))
      .toThrow('requires 612x384');
    expect(() => prepareFireFlameVfxFixture(new DeterministicBackend(WIDTH, HEIGHT), 'moving'))
      .toThrow('requires render-lab temperature, velocity, and wall planes');
  });
});

function prepared(mode: FireFlameVfxFixtureMode): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareFireFlameVfxFixture(simulation, mode);
  return simulation;
}

function cell(simulation: RenderLabBackend, point: FireFlameVfxPoint): number {
  return simulation.cells()[point.y * WIDTH + point.x];
}

function temperature(simulation: RenderLabBackend, point: FireFlameVfxPoint): number {
  return simulation.temperature()[point.y * WIDTH + point.x];
}

function velocity(simulation: RenderLabBackend, point: FireFlameVfxPoint): readonly [number, number] {
  const offset = (point.y * WIDTH + point.x) * 2;
  return [simulation.velocity()[offset], simulation.velocity()[offset + 1]];
}

function centre(rect: FireFlameVfxRect): FireFlameVfxPoint {
  return { x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) };
}

function expectRectState(
  simulation: RenderLabBackend,
  rect: FireFlameVfxRect,
  material: Material,
  expectedTemperature: number,
): void {
  forEach(rect, (point) => {
    expect(cell(simulation, point)).toBe(material);
    expect(temperature(simulation, point)).toBe(expectedTemperature);
  });
}

function connectedFireCells(
  simulation: RenderLabBackend,
  bounds: FireFlameVfxRect,
  start: FireFlameVfxPoint,
): number {
  const visited = new Uint8Array(WIDTH * HEIGHT);
  const queue: FireFlameVfxPoint[] = [start];
  let head = 0;
  let total = 0;
  while (head < queue.length) {
    const point = queue[head++];
    if (!contains(bounds, point)) continue;
    const index = point.y * WIDTH + point.x;
    if (visited[index] || simulation.cells()[index] !== Material.Fire) continue;
    visited[index] = 1;
    total++;
    queue.push(
      { x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 },
    );
  }
  return total;
}

function forEach(rect: FireFlameVfxRect, action: (point: FireFlameVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function contains(rect: FireFlameVfxRect, point: FireFlameVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function countRect(bytes: Uint8Array, rect: FireFlameVfxRect, value: number): number {
  let total = 0;
  forEach(rect, (point) => { total += Number(bytes[point.y * WIDTH + point.x] === value); });
  return total;
}

function count(bytes: Uint8Array, value: number): number {
  let total = 0;
  for (const byte of bytes) total += Number(byte === value);
  return total;
}

function countVelocityCells(velocityPlane: Int8Array): number {
  let total = 0;
  for (let offset = 0; offset < velocityPlane.length; offset += 2) {
    total += Number(velocityPlane[offset] !== 0 || velocityPlane[offset + 1] !== 0);
  }
  return total;
}

function temperatureCounts(temperatures: Uint16Array): { temperature: number; cells: number }[] {
  const counts = new Map<number, number>();
  for (const value of temperatures) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([left], [right]) => left - right)
    .map(([temperature, cells]) => ({ temperature, cells }));
}

function hashBytePlane(bytes: Uint8Array | Int8Array): number {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ (byte & 0xff), 16777619) >>> 0;
  return hash;
}

function hashUint16Plane(words: Uint16Array): number {
  let hash = 2166136261;
  for (const word of words) {
    hash = Math.imul(hash ^ (word & 0xff), 16777619) >>> 0;
    hash = Math.imul(hash ^ (word >>> 8), 16777619) >>> 0;
  }
  return hash;
}

function equalValues(
  left: Uint8Array | Int8Array | Uint16Array,
  right: Uint8Array | Int8Array | Uint16Array,
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
