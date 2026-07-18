import type { SimulationBackend } from '../simulation/types';

const ANIFOR_FILE_HEADER = 'anifortpt1\n';
export const MAX_WORLD_FILE_BYTES = 32 * 1024 * 1024;

export interface ExportedWorldFile {
  readonly bytes: Uint8Array;
  readonly extension: 'cps' | 'anifortpt';
  readonly mediaType: string;
  readonly powderToyCompatible: boolean;
}

/** True for the modern OPS1 format and the two legacy formats accepted by TPT. */
export function isPowderToySave(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (bytes[0] === 0x4F && bytes[1] === 0x50 && bytes[2] === 0x53 && bytes[3] === 0x31)
    || (bytes[0] === 0x50 && bytes[1] === 0x53 && bytes[2] === 0x76)
    || (bytes[0] === 0x66 && bytes[1] === 0x75 && bytes[2] === 0x43);
}

export function exportWorldFile(simulation: SimulationBackend): ExportedWorldFile {
  if (simulation.saveFile) {
    const bytes = simulation.saveFile();
    validateSize(bytes);
    if (!isPowderToySave(bytes)) throw new Error('Native backend returned an invalid Powder Toy save');
    return { bytes, extension: 'cps', mediaType: 'application/octet-stream', powderToyCompatible: true };
  }
  const bytes = new TextEncoder().encode(ANIFOR_FILE_HEADER + simulation.saveWorld());
  validateSize(bytes);
  return { bytes, extension: 'anifortpt', mediaType: 'application/x-anifortpt-save', powderToyCompatible: false };
}

export function importWorldFile(simulation: SimulationBackend, bytes: Uint8Array): void {
  validateSize(bytes);
  if (isPowderToySave(bytes)) {
    if (!simulation.loadFile) throw new Error('This browser build cannot open Powder Toy saves');
    simulation.loadFile(bytes);
    return;
  }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('Unrecognized save file'); }
  if (!text.startsWith(ANIFOR_FILE_HEADER)) throw new Error('Unrecognized save file');
  simulation.loadWorld(text.slice(ANIFOR_FILE_HEADER.length));
}

export function worldFileName(extension: ExportedWorldFile['extension'], date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
  return `AniforTPT-${stamp}.${extension}`;
}

function validateSize(bytes: Uint8Array): void {
  if (!bytes.length) throw new Error('Save file is empty');
  if (bytes.length > MAX_WORLD_FILE_BYTES) throw new Error('Save file is too large');
}
