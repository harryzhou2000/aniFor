import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { AtmosphereField } from './atmosphere-field';

const STYLE_STRIDE = 4;
const FLOW_ZERO_BYTE = 128;

function fixture(width = 20, height = 20): { field: AtmosphereField; materials: Uint8Array } {
  const gas = new Uint8Array(256);
  gas[Material.Smoke] = 1;
  gas[Material.Oxygen] = 1;
  const colors = new Uint8Array(256 * 3);
  colors.set([160, 165, 172], Material.Smoke * 3);
  colors.set([90, 155, 235], Material.Oxygen * 3);
  const styles = new Uint8Array(256);
  styles[Material.Smoke] = 1;
  styles[Material.Oxygen] = 4;
  return {
    field: new AtmosphereField(width, height, gas, colors, styles),
    materials: new Uint8Array(width * height),
  };
}

function alphaAt(field: AtmosphereField, x: number, y: number): number {
  return field.bytes[(y * field.width + x) * 4 + 3];
}

function styleAt(field: AtmosphereField, x: number, y: number): number {
  return field.styleBytes[(y * field.width + x) * STYLE_STRIDE];
}

function flowAt(field: AtmosphereField, x: number, y: number): readonly [number, number, number] {
  const offset = (y * field.width + x) * STYLE_STRIDE;
  return [
    field.styleBytes[offset + 1] - FLOW_ZERO_BYTE,
    field.styleBytes[offset + 2] - FLOW_ZERO_BYTE,
    field.styleBytes[offset + 3],
  ];
}

function identityBytes(field: AtmosphereField): Uint8Array {
  const identities = new Uint8Array(field.width * field.height);
  for (let index = 0; index < identities.length; index++) {
    identities[index] = field.styleBytes[index * STYLE_STRIDE];
  }
  return identities;
}

function fillRect(
  target: Uint8Array,
  width: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  value: number,
): void {
  for (let row = y; row < y + rectHeight; row++) {
    target.fill(value, row * width + x, row * width + x + rectWidth);
  }
}

function setGasVelocity(
  velocities: Int8Array,
  materials: Uint8Array,
  width: number,
  velocityX: (x: number, y: number) => number,
  velocityY: (x: number, y: number) => number = () => 0,
): void {
  for (let index = 0; index < materials.length; index++) {
    if (materials[index] !== Material.Smoke && materials[index] !== Material.Oxygen) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    velocities[index * 2] = velocityX(x, y);
    velocities[index * 2 + 1] = velocityY(x, y);
  }
}

describe('atmosphere field', () => {
  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    const bytes = field.bytes;
    const styles = field.styleBytes;
    const materials = new Uint8Array(612 * 384);
    const velocities = new Int8Array(materials.length * 2);
    materials[192 * 612 + 306] = Material.Smoke;
    velocities[(192 * 612 + 306) * 2] = 48;

    expect(field.allocatedByteLength).toBe(3_348_936);
    expect(field.allocatedByteLength).toBeLessThan(3.25 * 1024 * 1024);
    field.update(materials, undefined, velocities);
    velocities[(192 * 612 + 306) * 2] = -48;
    field.update(materials, undefined, velocities);
    expect(field.bytes).toBe(bytes);
    expect(field.styleBytes).toBe(styles);
    expect(field.allocatedByteLength).toBe(3_348_936);
  });

  it('widens a sparse gas cell into a soft bounded volume', () => {
    const { field, materials } = fixture();
    expect(field.hasVolume).toBe(false);
    materials[10 * 20 + 10] = Material.Smoke;
    field.update(materials);

    expect(field.hasVolume).toBe(true);
    expect(alphaAt(field, 5, 5)).toBeGreaterThan(alphaAt(field, 6, 5));
    expect(alphaAt(field, 6, 5)).toBeGreaterThan(alphaAt(field, 7, 5));
    expect(alphaAt(field, 7, 5)).toBeGreaterThan(0);
    expect(alphaAt(field, 8, 5)).toBe(0);
    for (let index = 0; index < field.width * field.height; index++) {
      expect(field.styleBytes[index * STYLE_STRIDE])
        .toBe(field.bytes[index * 4 + 3] > 0 ? 1 : 0);
    }
  });

  it('clears its packed-volume presence when the final gas source disappears', () => {
    const { field, materials } = fixture();
    field.update(materials);
    expect(field.hasVolume).toBe(false);

    materials[10 * 20 + 10] = Material.Smoke;
    field.update(materials);
    expect(field.hasVolume).toBe(true);

    materials.fill(Material.Empty);
    field.update(materials);
    expect(field.hasVolume).toBe(false);
    expect(field.bytes.every((value) => value === 0)).toBe(true);
  });

  it('merges nearby sparse gas cells and blends their colour', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 8] = Material.Smoke;
    materials[10 * 20 + 12] = Material.Oxygen;
    field.update(materials);

    const middle = (5 * field.width + 5) * 4;
    expect(field.bytes[middle + 3]).toBeGreaterThan(0);
    expect(field.bytes[middle]).toBeGreaterThan(90);
    expect(field.bytes[middle + 2]).toBeGreaterThan(172);
  });

  it('propagates a deterministic dominant identity across the same soft support', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 8] = Material.Smoke;
    materials[10 * 20 + 9] = Material.Smoke;
    materials[10 * 20 + 12] = Material.Oxygen;
    field.update(materials);

    expect(styleAt(field, 4, 5)).toBe(1);
    expect(styleAt(field, 5, 5)).toBe(1);
    expect(styleAt(field, 6, 5)).toBe(4);
    for (let index = 0; index < field.width * field.height; index++) {
      if (field.bytes[index * 4 + 3] === 0) {
        expect(field.styleBytes[index * STYLE_STRIDE]).toBe(0);
      }
    }
  });

  it('keeps an exactly balanced local mixture visually neutral', () => {
    const { field, materials } = fixture(8, 8);
    materials[2 * 8 + 2] = Material.Oxygen;
    materials[2 * 8 + 3] = Material.Smoke;
    field.update(materials);
    expect(styleAt(field, 1, 1)).toBe(0);
  });

  it('neutralizes categorical identity near non-gas contacts without changing volume', () => {
    const reference = fixture();
    const contacted = fixture();
    for (let y = 8; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      reference.materials[y * 20 + x] = Material.Smoke;
      contacted.materials[y * 20 + x] = Material.Smoke;
    }
    for (let y = 8; y <= 11; y++) for (let x = 12; x <= 15; x++) {
      contacted.materials[y * 20 + x] = Material.Water;
    }

    const referenceVelocity = new Int8Array(reference.materials.length * 2);
    const contactedVelocity = new Int8Array(contacted.materials.length * 2);
    setGasVelocity(referenceVelocity, reference.materials, 20, () => 48);
    setGasVelocity(contactedVelocity, contacted.materials, 20, () => 48);
    reference.field.update(reference.materials, undefined, referenceVelocity);
    contacted.field.update(contacted.materials, undefined, contactedVelocity);

    expect(contacted.field.bytes).toEqual(reference.field.bytes);
    expect(styleAt(contacted.field, 3, 5)).toBe(1);
    expect(styleAt(contacted.field, 4, 5)).toBe(0);
    expect(styleAt(contacted.field, 5, 5)).toBe(0);
    expect(styleAt(contacted.field, 6, 5)).toBe(0);
    expect(flowAt(contacted.field, 3, 5)).toEqual([48, 0, 255]);
    expect(flowAt(contacted.field, 4, 5)).toEqual([0, 0, 0]);
    expect(flowAt(contacted.field, 5, 5)).toEqual([0, 0, 0]);
  });

  it('treats native walls as categorical blockers without changing gas volume', () => {
    const reference = fixture();
    const walled = fixture();
    const walls = new Uint8Array(20 * 20);
    for (let y = 8; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      reference.materials[y * 20 + x] = Material.Smoke;
      walled.materials[y * 20 + x] = Material.Smoke;
    }
    for (let y = 8; y <= 11; y++) for (let x = 12; x <= 15; x++) {
      walls[y * 20 + x] = 1;
    }

    reference.field.update(reference.materials);
    walled.field.update(walled.materials, walls);

    expect(walled.field.bytes).toEqual(reference.field.bytes);
    expect(styleAt(walled.field, 3, 5)).toBe(1);
    expect(styleAt(walled.field, 4, 5)).toBe(0);
    expect(walled.field.mayHaveIdentityNearWorldIndex(10 * 20 + 12)).toBe(true);
    expect(walled.field.mayHaveIdentityNearWorldIndex(-1)).toBe(false);
  });

  it('rejects a wall field with the wrong geometry', () => {
    const { field, materials } = fixture();
    expect(() => field.update(materials, new Uint8Array(materials.length - 1)))
      .toThrow('Atmosphere wall field size mismatch');
  });

  it('rejects a velocity field with the wrong geometry', () => {
    const { field, materials } = fixture();
    expect(() => field.update(
      materials, undefined, new Int8Array(materials.length * 2 - 1),
    )).toThrow('Atmosphere velocity field size mismatch');
  });

  it('ignores liquids and powders', () => {
    const { field, materials } = fixture();
    materials[10 * 20 + 10] = Material.Water;
    materials[10 * 20 + 11] = Material.Sand;
    field.update(materials);
    expect(field.bytes.some(Boolean)).toBe(false);
  });

  it('keeps atmosphere colour, alpha, and identity invariant across coherent and noisy flow', () => {
    const width = 24;
    const height = 24;
    const scenes = Array.from({ length: 4 }, () => fixture(width, height));
    for (const scene of scenes) fillRect(
      scene.materials, width, 4, 4, 16, 16, Material.Smoke,
    );
    const [still, uniform, reversed, checker] = scenes;
    const stillVelocity = new Int8Array(width * height * 2);
    const uniformVelocity = new Int8Array(stillVelocity.length);
    const reversedVelocity = new Int8Array(stillVelocity.length);
    const checkerVelocity = new Int8Array(stillVelocity.length);
    setGasVelocity(uniformVelocity, uniform.materials, width, () => 48);
    setGasVelocity(reversedVelocity, reversed.materials, width, () => -48);
    setGasVelocity(checkerVelocity, checker.materials, width, (x, y) => (
      (x + y) % 2 === 0 ? 48 : -48
    ));

    still.field.update(still.materials, undefined, stillVelocity);
    uniform.field.update(uniform.materials, undefined, uniformVelocity);
    reversed.field.update(reversed.materials, undefined, reversedVelocity);
    checker.field.update(checker.materials, undefined, checkerVelocity);

    expect(uniform.field.bytes).toEqual(still.field.bytes);
    expect(reversed.field.bytes).toEqual(still.field.bytes);
    expect(checker.field.bytes).toEqual(still.field.bytes);
    expect(identityBytes(uniform.field)).toEqual(identityBytes(still.field));
    expect(identityBytes(reversed.field)).toEqual(identityBytes(still.field));
    expect(identityBytes(checker.field)).toEqual(identityBytes(still.field));

    for (let y = 4; y <= 7; y++) for (let x = 4; x <= 7; x++) {
      expect(flowAt(still.field, x, y)).toEqual([0, 0, 0]);
      expect(flowAt(uniform.field, x, y)).toEqual([48, 0, 255]);
      expect(flowAt(reversed.field, x, y)).toEqual([-48, 0, 255]);
      expect(flowAt(checker.field, x, y)).toEqual([0, 0, 0]);
    }
    for (let index = 0; index < checker.field.width * checker.field.height; index++) {
      if (checker.field.bytes[index * 4 + 3] === 0) continue;
      const x = index % checker.field.width;
      const y = Math.floor(index / checker.field.width);
      expect(flowAt(checker.field, x, y)).toEqual([0, 0, 0]);
    }
  });

  it('ignores velocities owned by empty, liquid, and powder cells', () => {
    const width = 20;
    const height = 20;
    const reference = fixture(width, height);
    const unsupported = fixture(width, height);
    fillRect(reference.materials, width, 8, 8, 4, 4, Material.Smoke);
    unsupported.materials.set(reference.materials);
    reference.materials[2 * width + 2] = Material.Water;
    reference.materials[2 * width + 3] = Material.Sand;
    unsupported.materials.set(reference.materials);
    const velocities = new Int8Array(width * height * 2);
    for (let index = 0; index < unsupported.materials.length; index++) {
      if (unsupported.materials[index] === Material.Smoke) continue;
      velocities[index * 2] = index % 2 === 0 ? 127 : -127;
      velocities[index * 2 + 1] = index % 3 === 0 ? -96 : 96;
    }

    reference.field.update(reference.materials);
    unsupported.field.update(unsupported.materials, undefined, velocities);

    expect(unsupported.field.bytes).toEqual(reference.field.bytes);
    expect(unsupported.field.styleBytes).toEqual(reference.field.styleBytes);
  });

  it('propagates opposed coherent flow through the existing five-tap kernel', () => {
    const width = 24;
    const height = 24;
    const { field, materials } = fixture(width, height);
    const velocities = new Int8Array(width * height * 2);
    fillRect(materials, width, 12, 12, 2, 2, Material.Smoke);
    fillRect(materials, width, 16, 12, 2, 2, Material.Smoke);
    setGasVelocity(velocities, materials, width, (x) => (x < 16 ? 48 : -48));

    field.update(materials, undefined, velocities);

    expect(flowAt(field, 5, 6)).toEqual([48, 0, 255]);
    expect(flowAt(field, 6, 6)).toEqual([34, 0, 181]);
    expect(flowAt(field, 7, 6)).toEqual([0, 0, 0]);
    expect(flowAt(field, 8, 6)).toEqual([-34, 0, 181]);
    expect(flowAt(field, 9, 6)).toEqual([-48, 0, 255]);
  });

  it('packs half-integer coherent flow with exact forward/reverse symmetry', () => {
    const width = 24;
    const height = 24;
    const forward = fixture(width, height);
    const reverse = fixture(width, height);
    fillRect(forward.materials, width, 4, 4, 16, 16, Material.Smoke);
    reverse.materials.set(forward.materials);
    const forwardVelocity = new Int8Array(width * height * 2);
    const reverseVelocity = new Int8Array(width * height * 2);
    setGasVelocity(forwardVelocity, forward.materials, width, (x) => (x % 2 ? 48 : 47));
    setGasVelocity(reverseVelocity, reverse.materials, width, (x) => (x % 2 ? -48 : -47));

    forward.field.update(forward.materials, undefined, forwardVelocity);
    reverse.field.update(reverse.materials, undefined, reverseVelocity);

    for (let y = 4; y <= 7; y++) for (let x = 4; x <= 7; x++) {
      const positive = flowAt(forward.field, x, y);
      const negative = flowAt(reverse.field, x, y);
      expect(positive).toEqual([48, 0, 255]);
      expect(negative).toEqual([-positive[0], 0, positive[2]]);
    }
  });
});
