import { createSimulation } from "../simulation/engine";
import { RULESET_VERSION, WORLD_HEIGHT, WORLD_WIDTH, type WorldSnapshot } from "../simulation/contracts";
import type { AuthoritativeSnapshot } from "../app/contracts";

/**
 * Canonical v1 envelope, little-endian:
 * magic[4]="ANIF", version u16, headerBytes u16, bodyBytes u32,
 * CRC-32(envelope with checksum bytes zeroed) u32, ruleset u16, width u16, height u16, reserved u16,
 * tick u64, seed u32, randomState u32, nextSequence u64,
 * materialBytes u32, lifetimeBytes u32, followed by material then lifetime.
 */
export const PERSISTENCE_MAGIC = "ANIF";
export const PERSISTENCE_VERSION = 1;
export const PERSISTENCE_HEADER_BYTES = 56;
export const MAX_ENCODED_TEXT_BYTES = 512 * 1024;
export const MAX_DECODED_BYTES = 256 * 1024;

const CELLS = WORLD_WIDTH * WORLD_HEIGHT;
const MATERIAL_BYTES = CELLS;
const LIFETIME_BYTES = CELLS * 2;
const BODY_BYTES = MATERIAL_BYTES + LIFETIME_BYTES;
const MAX_UINT32 = 0xffffffff;

export function encodeSnapshot(snapshot: AuthoritativeSnapshot): Uint8Array {
  assertSnapshot(snapshot);
  const bytes = new Uint8Array(PERSISTENCE_HEADER_BYTES + BODY_BYTES);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < PERSISTENCE_MAGIC.length; index += 1) bytes[index] = PERSISTENCE_MAGIC.charCodeAt(index);
  view.setUint16(4, PERSISTENCE_VERSION, true);
  view.setUint16(6, PERSISTENCE_HEADER_BYTES, true);
  view.setUint32(8, BODY_BYTES, true);
  view.setUint32(12, 0, true);
  view.setUint16(16, snapshot.world.rulesetVersion, true);
  view.setUint16(18, snapshot.world.width, true);
  view.setUint16(20, snapshot.world.height, true);
  view.setUint16(22, 0, true);
  view.setBigUint64(24, BigInt(snapshot.world.tick), true);
  view.setUint32(32, snapshot.world.seed, true);
  view.setUint32(36, snapshot.world.randomState, true);
  view.setBigUint64(40, BigInt(snapshot.nextSequence), true);
  view.setUint32(48, MATERIAL_BYTES, true);
  view.setUint32(52, LIFETIME_BYTES, true);
  bytes.set(snapshot.world.material, PERSISTENCE_HEADER_BYTES);
  for (let index = 0; index < CELLS; index += 1) view.setUint16(PERSISTENCE_HEADER_BYTES + MATERIAL_BYTES + index * 2, snapshot.world.lifetime[index], true);
  view.setUint32(12, crc32(bytes), true);
  return bytes;
}

export function decodeSnapshot(input: ArrayBuffer | Uint8Array): AuthoritativeSnapshot {
  const bytes = input instanceof Uint8Array ? input.slice() : new Uint8Array(input.slice(0));
  if (bytes.byteLength > MAX_DECODED_BYTES || bytes.byteLength < PERSISTENCE_HEADER_BYTES) throw new Error("Invalid persistence size");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < PERSISTENCE_MAGIC.length; index += 1) if (bytes[index] !== PERSISTENCE_MAGIC.charCodeAt(index)) throw new Error("Invalid persistence magic");
  if (view.getUint16(4, true) !== PERSISTENCE_VERSION || view.getUint16(6, true) !== PERSISTENCE_HEADER_BYTES) throw new Error("Invalid persistence header");
  const bodyBytes = view.getUint32(8, true);
  if (bodyBytes !== BODY_BYTES || PERSISTENCE_HEADER_BYTES + bodyBytes !== bytes.byteLength) throw new Error("Invalid persistence length");
  if (view.getUint16(16, true) !== RULESET_VERSION || view.getUint16(18, true) !== WORLD_WIDTH || view.getUint16(20, true) !== WORLD_HEIGHT || view.getUint16(22, true) !== 0) throw new Error("Invalid persistence dimensions");
  if (view.getUint32(48, true) !== MATERIAL_BYTES || view.getUint32(52, true) !== LIFETIME_BYTES) throw new Error("Invalid persistence arrays");
  const suppliedChecksum = view.getUint32(12, true);
  if (suppliedChecksum !== crc32(bytes)) throw new Error("Invalid persistence checksum");
  const tick = safeBigInt(view.getBigUint64(24, true));
  const nextSequence = safeBigInt(view.getBigUint64(40, true));
  const material = bytes.slice(PERSISTENCE_HEADER_BYTES, PERSISTENCE_HEADER_BYTES + MATERIAL_BYTES);
  const lifetime = new Uint16Array(CELLS);
  for (let index = 0; index < CELLS; index += 1) lifetime[index] = view.getUint16(PERSISTENCE_HEADER_BYTES + MATERIAL_BYTES + index * 2, true);
  const snapshot: AuthoritativeSnapshot = {
    nextSequence,
    world: { rulesetVersion: RULESET_VERSION, width: WORLD_WIDTH, height: WORLD_HEIGHT, tick, seed: view.getUint32(32, true), randomState: view.getUint32(36, true), material, lifetime: lifetime.slice() }
  };
  assertSnapshot(snapshot);
  return snapshot;
}

export function snapshotToBase64(snapshot: AuthoritativeSnapshot): string {
  return bytesToBase64(encodeSnapshot(snapshot));
}

export function snapshotFromBase64(text: string): AuthoritativeSnapshot {
  if (text.length > MAX_ENCODED_TEXT_BYTES || text.length === 0 || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error("Invalid persistence text");
  if (Math.floor(text.length * 3 / 4) > MAX_DECODED_BYTES) throw new Error("Persistence text is too large");
  let binary: string;
  try { binary = atob(text); } catch { throw new Error("Invalid Base64"); }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return decodeSnapshot(bytes);
}

export function snapshotToBlob(snapshot: AuthoritativeSnapshot): Blob {
  const bytes = encodeSnapshot(snapshot);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type: "application/octet-stream" });
}

export async function snapshotFromBlob(blob: Blob): Promise<AuthoritativeSnapshot> {
  if (blob.size > MAX_DECODED_BYTES) throw new Error("Persistence file is too large");
  return decodeSnapshot(await blob.arrayBuffer());
}

export interface SnapshotReplacer { replaceWithRecovery(snapshot: AuthoritativeSnapshot): boolean; }

export function applyBase64(controller: SnapshotReplacer, text: string): boolean {
  try { return controller.replaceWithRecovery(snapshotFromBase64(text)); } catch { return false; }
}

export async function applyBlob(controller: SnapshotReplacer, blob: Blob): Promise<boolean> {
  try { return controller.replaceWithRecovery(await snapshotFromBlob(blob)); } catch { return false; }
}

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }

export function createAutosave(storage: StorageLike, key: string) {
  return {
    save(snapshot: AuthoritativeSnapshot): boolean { try { storage.setItem(key, snapshotToBase64(snapshot)); return true; } catch { return false; } },
    load(): AuthoritativeSnapshot | null {
      let text: string | null = null;
      try { text = storage.getItem(key); } catch { return null; }
      if (text === null) return null;
      try { return snapshotFromBase64(text); } catch { try { storage.removeItem(key); } catch { /* storage may be unavailable */ } return null; }
    },
    clear(): void { try { storage.removeItem(key); } catch { /* storage may be unavailable */ } }
  };
}

function assertSnapshot(snapshot: AuthoritativeSnapshot): void {
  if (!snapshot || !Number.isSafeInteger(snapshot.nextSequence) || snapshot.nextSequence < 0) throw new Error("Invalid sequence");
  if (!snapshot.world || !Number.isSafeInteger(snapshot.world.tick) || snapshot.world.tick < 0) throw new Error("Invalid tick");
  if (snapshot.world.material.length !== CELLS || snapshot.world.lifetime.length !== CELLS) throw new Error("Invalid array length");
  try { createSimulation(snapshot.world.seed).restore(snapshot.world); } catch { throw new Error("Invalid world snapshot"); }
}

function safeBigInt(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error("Unsafe persistence integer");
  return number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  // Chunks must end on a 3-byte boundary so concatenated Base64 remains canonical.
  for (let offset = 0; offset < bytes.length; offset += 0x7ffe) output += btoa(String.fromCharCode(...bytes.subarray(offset, offset + 0x7ffe)));
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = MAX_UINT32;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = index >= 12 && index < 16 ? 0 : bytes[index];
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ MAX_UINT32) >>> 0;
}
