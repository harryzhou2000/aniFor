import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  PLNT_PRESENTATION_STATE,
  SEED_PRESENTATION_STATE,
} from '../simulation/types';
import {
  applyCanvasBotanicalLifecycleStyle,
  TPT_TREE_LEAF_PALETTE,
  tptTreeLeafPaletteIndex,
} from './canvas-botanical-lifecycle-style';

const SOURCE = [101, 169, 95, 0.625] as const;
const SOURCE_FLOAT = Array.from(new Float32Array(SOURCE));
const LEAF_COLOUR_CODES = [0, 1, 4, 5, 16, 17, 20, 21] as const;

function encodeSeed(water: number, timer: number): number {
  return (water & SEED_PRESENTATION_STATE.waterMask)
    | ((timer << SEED_PRESENTATION_STATE.germinationShift)
      & SEED_PRESENTATION_STATE.germinationMask);
}

function encodePlant(
  inheritedColour: number,
  phase = 0,
  direction = 4,
  hydrationClass = 0,
  active = false,
  tree = true,
): number {
  return PLNT_PRESENTATION_STATE.presentMask
    | (tree ? PLNT_PRESENTATION_STATE.treeMask : 0)
    | ((phase << PLNT_PRESENTATION_STATE.phaseShift) & PLNT_PRESENTATION_STATE.phaseMask)
    | ((direction << PLNT_PRESENTATION_STATE.directionShift)
      & PLNT_PRESENTATION_STATE.directionMask)
    | ((inheritedColour << PLNT_PRESENTATION_STATE.inheritedColourShift)
      & PLNT_PRESENTATION_STATE.inheritedColourMask)
    | ((hydrationClass << PLNT_PRESENTATION_STATE.hydrationClassShift)
      & PLNT_PRESENTATION_STATE.hydrationClassMask)
    | (active ? PLNT_PRESENTATION_STATE.activeGrowthMask : 0);
}

function styled(material: number, state: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasBotanicalLifecycleStyle(output, material, state, x, y);
  return Array.from(output);
}

function rgbDistance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

describe('Canvas native botanical lifecycle styling', () => {
  it('decodes all eight upstream cyan/magenta/yellow leaf classes exactly', () => {
    expect(TPT_TREE_LEAF_PALETTE.length).toBe(24);
    for (let index = 0; index < LEAF_COLOUR_CODES.length; index++) {
      expect(tptTreeLeafPaletteIndex(LEAF_COLOUR_CODES[index])).toBe(index);
    }
    expect(tptTreeLeafPaletteIndex(0x3f)).toBe(7);
    expect(tptTreeLeafPaletteIndex(0x40)).toBe(0);
  });

  it('keeps dormant SEED, presence-only PLNT, absent state, and wrong owners exact no-ops', () => {
    expect(styled(Material.SEED, 0, 5, 5)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.Plant, 0, 5, 5)).toEqual(SOURCE_FLOAT);
    expect(styled(
      Material.Plant, PLNT_PRESENTATION_STATE.presentMask, 5, 5,
    )).toEqual(SOURCE_FLOAT);
    expect(styled(
      Material.Plant, encodePlant(21, 2, 4, 3, true, false), 5, 5,
    )).toEqual(SOURCE_FLOAT);
    const treeState = encodePlant(21, 2, 4, 3, true);
    expect(styled(Material.Wood, treeState, 5, 5)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.SEED, treeState, 5, 5)).not.toEqual(SOURCE_FLOAT);
    expect(styled(Material.Water, encodeSeed(255, 200), 5, 5)).toEqual(SOURCE_FLOAT);
  });

  it('turns exact SEED water and timer into distinct wetting, swelling, and germination cues', () => {
    const lowWater = styled(Material.SEED, encodeSeed(1, 0), 6, 6);
    const wetBody = styled(Material.SEED, encodeSeed(255, 0), 6, 6);
    const swollenHusk = styled(Material.SEED, encodeSeed(255, 0), 5, 1);
    const earlySeam = styled(Material.SEED, encodeSeed(255, 50), 5, 5);
    const openSeam = styled(Material.SEED, encodeSeed(255, 200), 5, 5);
    expect(lowWater).not.toEqual(SOURCE_FLOAT);
    expect(wetBody[0]).toBeLessThan(lowWater[0]);
    expect(wetBody[2] - SOURCE[2]).toBeGreaterThan(wetBody[0] - SOURCE[0]);
    expect(swollenHusk).not.toEqual(wetBody);
    expect(openSeam[1]).toBeGreaterThan(earlySeam[1]);
    expect(openSeam).not.toEqual(wetBody);
  });

  it('moves every inherited tree colour toward its exact upstream leaf target', () => {
    const fingerprints = new Set<string>();
    for (let index = 0; index < LEAF_COLOUR_CODES.length; index++) {
      const state = encodePlant(LEAF_COLOUR_CODES[index], index & 3, index & 7, 2, true);
      const result = styled(Material.Plant, state, 23, 19);
      const targetOffset = index * 3;
      const target = [
        TPT_TREE_LEAF_PALETTE[targetOffset],
        TPT_TREE_LEAF_PALETTE[targetOffset + 1],
        TPT_TREE_LEAF_PALETTE[targetOffset + 2],
      ];
      expect(rgbDistance(result, target)).toBeLessThan(rgbDistance(SOURCE, target));
      fingerprints.add(result.slice(0, 3).map((value) => value.toFixed(3)).join(','));
    }
    expect(fingerprints.size).toBe(8);
  });

  it('uses phase/direction veins and active growth tips without changing inherited identity', () => {
    const quiet = styled(Material.Plant, encodePlant(21, 0, 0, 0, false), 1, 0);
    const directional = styled(Material.Plant, encodePlant(21, 3, 6, 0, false), 1, 0);
    const active = styled(Material.Plant, encodePlant(21, 3, 6, 0, true), 1, 0);
    const hydrated = styled(Material.Plant, encodePlant(21, 3, 6, 3, true), 1, 0);
    expect(directional).not.toEqual(quiet);
    expect(active).not.toEqual(directional);
    expect(hydrated).not.toEqual(active);
  });

  it('is deterministic in integer world space, RGB-bounded, byte-safe, and alpha-invariant', () => {
    const states = [
      { material: Material.SEED, state: encodeSeed(1, 0), bound: 24 },
      { material: Material.SEED, state: encodeSeed(255, 255), bound: 24 },
      { material: Material.Plant, state: encodePlant(0, 0, 0, 0, false), bound: 64 },
      { material: Material.Plant, state: encodePlant(21, 3, 7, 3, true), bound: 64 },
    ] as const;
    for (const { material, state, bound } of states) {
      for (let y = -20; y <= 20; y++) for (let x = -20; x <= 20; x++) {
        const first = styled(material, state, x, y);
        expect(styled(material, state, x, y)).toEqual(first);
        expect(styled(material, state, x + 0.75, y + 0.25)).toEqual(first);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(bound);
          expect(first[channel]).toBeGreaterThanOrEqual(0);
          expect(first[channel]).toBeLessThanOrEqual(255);
        }
        expect(first[3]).toBe(SOURCE_FLOAT[3]);
      }
    }
  });
});
