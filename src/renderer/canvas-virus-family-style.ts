import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';

const TILE_SHIFT = 4;
const TILE_SIZE = 1 << TILE_SHIFT;
const TILE_MASK = TILE_SIZE - 1;
const TILE_CELLS = TILE_SIZE * TILE_SIZE;
const CHANNELS = 3;
const PHASE_COUNT = 3;

/**
 * One world-anchored capsid language shared by liquid, gas, and solid virus.
 * The phase slices retain different optical weight, but their membrane, core,
 * and attachment-node locations stay aligned through native phase changes.
 */
const VIRUS_FAMILY_RGB = new Int8Array(PHASE_COUNT * TILE_CELLS * CHANNELS);

buildVirusFamilyLookup();

/** Bounded module-static bytes; independent of world and presentation scale. */
export const CANVAS_VIRUS_FAMILY_LOOKUP_BYTES = VIRUS_FAMILY_RGB.byteLength;

export function isVirusFamilyMaterial(material: number): boolean {
  return material === Material.VIRS || material === Material.VRSG || material === Material.VRSS;
}

/** Signed canonical motif byte used to seed the existing liquid/gas atlases. */
export function canvasVirusFamilyMotifDelta(
  phase: RenderPhase,
  worldX: number,
  worldY: number,
  channel: 0 | 1 | 2,
): number {
  const familyPhase = phase === RenderPhase.Liquid ? 0
    : phase === RenderPhase.Gas ? 1
      : phase === RenderPhase.Solid ? 2 : -1;
  if (familyPhase < 0) return 0;
  const cell = ((worldY & TILE_MASK) << TILE_SHIFT) | (worldX & TILE_MASK);
  return VIRUS_FAMILY_RGB[(familyPhase * TILE_CELLS + cell) * CHANNELS + channel];
}

/**
 * Replaces the generic green Organic vein on exact virus cells with a coherent
 * magenta membrane/capsid accent. RGB only: phase fields and the caller retain
 * ownership of alpha, support, reconstruction, lighting, and physics.
 */
export function applyCanvasVirusFamilyMorphology(
  output: Float32Array,
  material: number,
  phase: RenderPhase,
  x: number,
  y: number,
): void {
  const familyPhase = virusPhase(material, phase);
  if (familyPhase < 0) return;
  const cell = ((y & TILE_MASK) << TILE_SHIFT) | (x & TILE_MASK);
  const offset = (familyPhase * TILE_CELLS + cell) * CHANNELS;
  output[0] += VIRUS_FAMILY_RGB[offset];
  output[1] += VIRUS_FAMILY_RGB[offset + 1];
  output[2] += VIRUS_FAMILY_RGB[offset + 2];
}

function virusPhase(material: number, phase: RenderPhase): number {
  if (material === Material.VIRS && phase === RenderPhase.Liquid) return 0;
  if (material === Material.VRSG && phase === RenderPhase.Gas) return 1;
  if (material === Material.VRSS && phase === RenderPhase.Solid) return 2;
  return -1;
}

function buildVirusFamilyLookup(): void {
  for (let familyPhase = 0; familyPhase < PHASE_COUNT; familyPhase++) {
    for (let y = 0; y < TILE_SIZE; y++) for (let x = 0; x < TILE_SIZE; x++) {
      const localX = x - 7.5;
      const localY = y - 7.5;
      const radiusSquared = localX * localX + localY * localY;
      const membrane = radiusSquared >= 24.5 && radiusSquared <= 43.5;
      const capsid = radiusSquared >= 5.0 && radiusSquared <= 14.5;
      const attachment = (Math.abs(localX) >= 6.5 && Math.abs(localY) <= 1.5)
        || (Math.abs(localY) >= 6.5 && Math.abs(localX) <= 1.5);
      const bridge = ((x + (y >> 1)) & 7) === 0 && radiusSquared > 14.5 && radiusSquared < 24.5;

      let red = 1;
      let green = -1;
      let blue = 2;
      if (familyPhase === 0) {
        // Liquid virus: a soft membrane with a restrained flowing bridge.
        if (attachment) { red = 10; green = -3; blue = 11; }
        else if (membrane) { red = 8; green = -5; blue = 10; }
        else if (capsid) { red = -2; green = 3; blue = 7; }
        else if (bridge) { red = 4; green = -2; blue = 5; }
      } else if (familyPhase === 1) {
        // Gas virus: the same capsid is paler, with sparse detached vesicles.
        const vesicle = ((x * 5 + y * 3) & 31) === 0;
        if (attachment) { red = 8; green = -2; blue = 9; }
        else if (membrane) { red = 6; green = -4; blue = 8; }
        else if (capsid) { red = -1; green = 3; blue = 6; }
        else if (vesicle) { red = 5; green = -2; blue = 6; }
        else { red = 1; green = 0; blue = 2; }
      } else {
        // Solid virus: a sharper frozen shell and brighter attachment nodes.
        const shellJoint = membrane && ((x + y) & 3) === 0;
        if (attachment) { red = 12; green = -3; blue = 12; }
        else if (shellJoint) { red = 10; green = -5; blue = 12; }
        else if (membrane) { red = 8; green = -5; blue = 10; }
        else if (capsid) { red = -3; green = 4; blue = 8; }
      }

      const offset = (familyPhase * TILE_CELLS + y * TILE_SIZE + x) * CHANNELS;
      VIRUS_FAMILY_RGB[offset] = red;
      VIRUS_FAMILY_RGB[offset + 1] = green;
      VIRUS_FAMILY_RGB[offset + 2] = blue;
    }
  }
}
