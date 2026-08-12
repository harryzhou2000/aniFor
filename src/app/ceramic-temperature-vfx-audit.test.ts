import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  CERAMIC_TEMPERATURE_VFX_AUDIT, prepareCeramicTemperatureVfxFixture,
  type CeramicTemperatureVfxPoint, type CeramicTemperatureVfxRect,
} from './ceramic-temperature-vfx-audit';

const AMBIENT = 2_952;
const HOT_CONTROL = 23_040;

describe('Ceramic temperature VFX audit fixture', () => {
  it('pins exact CRMC owner IDs, native decikelvin values, and semantic temperature bytes', () => {
    const simulation = preparedFixture();
    expect(CERAMIC_TEMPERATURE_VFX_AUDIT.material).toBe(Material.Ceramic);
    expect(Material.Ceramic).toBe(25);
    expect(CERAMIC_TEMPERATURE_VFX_AUDIT.cards.map((entry) => ({
      key: entry.key, material: entry.material, temperature: entry.temperature,
      temperatureByte: entry.temperatureByte,
    }))).toEqual([
      { key: 'ambient', material: 25, temperature: 2_952, temperatureByte: 11 },
      { key: 'onset', material: 25, temperature: 8_192, temperatureByte: 32 },
      { key: 'warm', material: 25, temperature: 12_288, temperatureByte: 48 },
      { key: 'orange', material: 25, temperature: 15_360, temperatureByte: 60 },
      { key: 'bright', material: 25, temperature: 23_040, temperatureByte: 90 },
    ]);
    for (const entry of CERAMIC_TEMPERATURE_VFX_AUDIT.cards) {
      expectBodyTemperature(
        simulation.cells(), simulation.temperature(), simulation.width,
        entry.body, entry.authoredHole, entry.openNotch, entry.temperature,
      );
      expectRect(simulation.cells(), simulation.width, entry.core, Material.Ceramic);
      expectRect(simulation.temperature(), simulation.width, entry.core, entry.temperature);
      const core = centre(entry.core);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        expect(cellAt(simulation.cells(), simulation.width, core.x + dx, core.y + dy)).toBe(Material.Ceramic);
        expect(cellAt(simulation.temperature(), simulation.width, core.x + dx, core.y + dy)).toBe(entry.temperature);
      }
    }
  });

  it('keeps void, fine, wall, contact, blank, Brick, and other-owner hot controls exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const temperatures = simulation.temperature();
    const walls = simulation.walls();
    for (const entry of CERAMIC_TEMPERATURE_VFX_AUDIT.cards) {
      expectRect(cells, simulation.width, entry.authoredHole, Material.Empty);
      expectRect(cells, simulation.width, entry.openNotch, Material.Empty);
      expectRect(temperatures, simulation.width, entry.authoredHole, AMBIENT);
      expectRect(temperatures, simulation.width, entry.openNotch, AMBIENT);
      expectRect(cells, simulation.width, entry.thinLine, Material.Ceramic);
      expectRect(temperatures, simulation.width, entry.thinLine, entry.temperature);
      expect(cellAt(cells, simulation.width, entry.isolated)).toBe(Material.Ceramic);
      expect(cellAt(temperatures, simulation.width, entry.isolated)).toBe(entry.temperature);
      expectRect(cells, simulation.width, entry.wallCoexistence, Material.Ceramic);
      expectRect(temperatures, simulation.width, entry.wallCoexistence, entry.temperature);
      expectWallChecker(walls, simulation.width, entry.wallCoexistence);
      expectRect(cells, simulation.width, entry.waterContact.ceramic, Material.Ceramic);
      expectRect(temperatures, simulation.width, entry.waterContact.ceramic, entry.temperature);
      expectRect(cells, simulation.width, entry.waterContact.water, Material.Water);
      expectRect(temperatures, simulation.width, entry.waterContact.water, AMBIENT);
      expect(entry.waterContact.ceramic.x + entry.waterContact.ceramic.width)
        .toBe(entry.waterContact.water.x);
      expectRect(cells, simulation.width, entry.hotControls.brick, Material.Brick);
      expectRect(temperatures, simulation.width, entry.hotControls.brick, HOT_CONTROL);
      expectRect(cells, simulation.width, entry.hotControls.metal, Material.Metal);
      expectRect(temperatures, simulation.width, entry.hotControls.metal, HOT_CONTROL);
      expectRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
      expectRect(temperatures, simulation.width, entry.guardedBlank, AMBIENT);
    }
  });

  it('pins all three semantic planes bytewise and rebuilds them deterministically', () => {
    const simulation = preparedFixture();
    const initial = planes(simulation);
    expect(summary(simulation)).toEqual(CERAMIC_TEMPERATURE_VFX_AUDIT.expected);
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    simulation.setFixtureTemperatureRect(2, 2, 1, 1, 0xffff);
    prepareCeramicTemperatureVfxFixture(simulation);
    expect(planes(simulation)).toEqual(initial);
    expect(summary(simulation)).toEqual(CERAMIC_TEMPERATURE_VFX_AUDIT.expected);
  });

  it('keeps every declared rectangle inside the canonical world and rejects unsupported backends', () => {
    for (const entry of CERAMIC_TEMPERATURE_VFX_AUDIT.cards) {
      for (const rect of [
        entry.card, entry.body, entry.core, entry.authoredHole, entry.openNotch,
        entry.thinLine, entry.wallCoexistence, entry.waterContact.ceramic,
        entry.waterContact.water, entry.hotControls.brick, entry.hotControls.metal,
        entry.guardedBlank,
      ]) expectInWorld(rect);
      expect(inside(entry.core, entry.body)).toBe(true);
      expect(intersects(entry.core, entry.authoredHole)).toBe(false);
      expect(intersects(entry.core, entry.openNotch)).toBe(false);
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
    }
    expect(() => prepareCeramicTemperatureVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab temperature and native wall planes');
    expect(() => prepareCeramicTemperatureVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });

  it('preserves the pre-migration snapshot and exact material, temperature, and wall planes', () => {
    const simulation = preparedFixture();
    const temperatureBytes = Buffer.alloc(simulation.temperature().byteLength);
    simulation.temperature().forEach((value, index) => temperatureBytes.writeUInt16LE(value, index * 2));
    expect(digest(JSON.stringify(CERAMIC_TEMPERATURE_VFX_AUDIT))).toBe(
      '4538c106851a2e137368e87cc9ef7939dd7a4ff31652a604fbbfb858e7820c7e',
    );
    expect(digest(simulation.cells())).toBe(
      'c44a48a6527831469c24aee261be0791dc7f8bcdaf597a6b5b25b583c8894bc8',
    );
    expect(digest(temperatureBytes)).toBe(
      'eb8ea2f8f3d327f2c44068ce05247019334e54e2e133df5d98d74f08def76bd1',
    );
    expect(digest(simulation.walls())).toBe(
      '6c0ffb9c0633b6028d72b7a1bcacfb6d579e0bffa4a1dccb4e9896dcddb8afcc',
    );
  });
});

function digest(value: string | NodeJS.ArrayBufferView): string {
  return createHash('sha256').update(value).digest('hex');
}

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareCeramicTemperatureVfxFixture(simulation);
  return simulation;
}

function planes(simulation: RenderLabBackend) {
  return {
    cells: Array.from(simulation.cells()),
    temperatures: Array.from(simulation.temperature()),
    walls: Array.from(simulation.walls()),
  };
}

function summary(simulation: RenderLabBackend) {
  const materialCounts = count(simulation.cells());
  const temperatureCounts = [...count(simulation.temperature())]
    .sort(([left], [right]) => left - right)
    .map(([temperature, cells]) => ({ temperature, cells }));
  return {
    ceramicCells: materialCounts.get(Material.Ceramic) ?? 0,
    waterCells: materialCounts.get(Material.Water) ?? 0,
    brickCells: materialCounts.get(Material.Brick) ?? 0,
    metalCells: materialCounts.get(Material.Metal) ?? 0,
    wallCells: [...simulation.walls()].filter((wall) => wall !== 0).length,
    temperatureCounts,
    materialHash: fnv(simulation.cells()),
    temperatureHash: fnvTemperature(simulation.temperature()),
    wallHash: fnv(simulation.walls()),
  };
}

function count(values: Uint8Array | Uint16Array): Map<number, number> {
  const result = new Map<number, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function fnv(values: Uint8Array): number {
  let hash = 2_166_136_261;
  for (const value of values) hash = Math.imul(hash ^ value, 16_777_619) >>> 0;
  return hash;
}

function fnvTemperature(values: Uint16Array): number {
  let hash = 2_166_136_261;
  for (const value of values) {
    hash = Math.imul(hash ^ (value & 255), 16_777_619) >>> 0;
    hash = Math.imul(hash ^ (value >>> 8), 16_777_619) >>> 0;
  }
  return hash;
}

function expectBodyTemperature(
  cells: Uint8Array, temperatures: Uint16Array, width: number,
  body: CeramicTemperatureVfxRect, hole: CeramicTemperatureVfxRect,
  notch: CeramicTemperatureVfxRect, temperature: number,
): void {
  for (let y = body.y; y < body.y + body.height; y++) {
    for (let x = body.x; x < body.x + body.width; x++) {
      const voidCell = contains(hole, x, y) || contains(notch, x, y);
      expect(cellAt(cells, width, x, y)).toBe(voidCell ? Material.Empty : Material.Ceramic);
      expect(cellAt(temperatures, width, x, y)).toBe(voidCell ? AMBIENT : temperature);
    }
  }
}

function expectRect(
  plane: Uint8Array | Uint16Array, width: number, rect: CeramicTemperatureVfxRect, value: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cellAt(plane, width, x, y)).toBe(value);
  }
}

function expectWallChecker(walls: Uint8Array, width: number, region: CeramicTemperatureVfxRect): void {
  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const column = Math.floor((x - region.x) / 4);
      const row = Math.floor((y - region.y) / 4);
      expect(cellAt(walls, width, x, y)).toBe((column + row) % 2 === 0 ? 1 : 0);
    }
  }
}

function cellAt(
  plane: Uint8Array | Uint16Array, width: number, x: number, y: number,
): number;
function cellAt(
  plane: Uint8Array | Uint16Array, width: number, point: CeramicTemperatureVfxPoint,
): number;
function cellAt(
  plane: Uint8Array | Uint16Array, width: number,
  xOrPoint: number | CeramicTemperatureVfxPoint, y?: number,
): number {
  const x = typeof xOrPoint === 'number' ? xOrPoint : xOrPoint.x;
  const actualY = typeof xOrPoint === 'number' ? y! : xOrPoint.y;
  return plane[actualY * width + x];
}

function centre(rect: CeramicTemperatureVfxRect): CeramicTemperatureVfxPoint {
  return { x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) };
}

function expectInWorld(rect: CeramicTemperatureVfxRect): void {
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(612);
  expect(rect.y + rect.height).toBeLessThanOrEqual(384);
}

function inside(inner: CeramicTemperatureVfxRect, outer: CeramicTemperatureVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function intersects(left: CeramicTemperatureVfxRect, right: CeramicTemperatureVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function contains(rect: CeramicTemperatureVfxRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
