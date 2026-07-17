import { createSimulation, AMBIENT_TEMPERATURE, FIRE_TEMPERATURE, SMOKE_TEMPERATURE, ICE_TEMPERATURE } from "../simulation/engine";
import { MaterialId, RULESET_VERSION, WORLD_HEIGHT, WORLD_WIDTH, type WorldSnapshot } from "../simulation/contracts";
import type { AuthoritativeSnapshot } from "../app/contracts";

/**
 * V1 envelope (little-endian): the original 56-byte header followed by
 * material and lifetime. V2 keeps the common prefix and adds temperatureBytes
 * at byte 56, making its header 60 bytes. Both checksums cover the complete
 * envelope with bytes 12..15 treated as zero.
 */
export const PERSISTENCE_MAGIC = "ANIF";
export const PERSISTENCE_VERSION = 2;
export const PERSISTENCE_V1_VERSION = 1;
export const PERSISTENCE_HEADER_BYTES = 60;
export const PERSISTENCE_V1_HEADER_BYTES = 56;
export const MAX_ENCODED_TEXT_BYTES = 512 * 1024;
export const MAX_DECODED_BYTES = 256 * 1024;

const CELLS = WORLD_WIDTH * WORLD_HEIGHT;
const MATERIAL_BYTES = CELLS;
const LIFETIME_BYTES = CELLS * 2;
const TEMPERATURE_BYTES = CELLS * 2;
const V1_BODY_BYTES = MATERIAL_BYTES + LIFETIME_BYTES;
const V2_BODY_BYTES = V1_BODY_BYTES + TEMPERATURE_BYTES;
const MAX_UINT32 = 0xffffffff;

export type PersistenceErrorKind = "corrupt" | "unsupported-version" | "invalid-input";

export class PersistenceError extends Error {
  readonly kind: PersistenceErrorKind;
  constructor(kind: PersistenceErrorKind, message: string) {
    super(message);
    this.name = "PersistenceError";
    this.kind = kind;
  }
}

export type PersistenceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PersistenceError };

export function encodeSnapshot(snapshot: AuthoritativeSnapshot): Uint8Array {
  assertSnapshot(snapshot);
  const bytes = new Uint8Array(PERSISTENCE_HEADER_BYTES + V2_BODY_BYTES);
  const view = new DataView(bytes.buffer);
  writeMagic(bytes);
  view.setUint16(4, PERSISTENCE_VERSION, true);
  view.setUint16(6, PERSISTENCE_HEADER_BYTES, true);
  view.setUint32(8, V2_BODY_BYTES, true);
  view.setUint32(12, 0, true);
  writeMetadata(view, snapshot, 2);
  view.setUint32(48, MATERIAL_BYTES, true);
  view.setUint32(52, LIFETIME_BYTES, true);
  view.setUint32(56, TEMPERATURE_BYTES, true);
  bytes.set(snapshot.world.material, PERSISTENCE_HEADER_BYTES);
  for (let index = 0; index < CELLS; index += 1) {
    view.setUint16(PERSISTENCE_HEADER_BYTES + MATERIAL_BYTES + index * 2, snapshot.world.lifetime[index], true);
    view.setInt16(PERSISTENCE_HEADER_BYTES + MATERIAL_BYTES + LIFETIME_BYTES + index * 2, snapshot.world.temperature[index], true);
  }
  view.setUint32(12, crc32(bytes), true);
  return bytes;
}

export function decodeSnapshot(input: ArrayBuffer | Uint8Array): AuthoritativeSnapshot {
  const bytes = input instanceof Uint8Array ? input.slice() : new Uint8Array(input.slice(0));
  if (bytes.byteLength > MAX_DECODED_BYTES || bytes.byteLength < PERSISTENCE_V1_HEADER_BYTES) throw corrupt("Invalid persistence size");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  checkMagic(bytes);
  const version = view.getUint16(4, true);
  if (version !== PERSISTENCE_V1_VERSION && version !== PERSISTENCE_VERSION) throw unsupported(`Unsupported persistence version ${version}`);
  const headerBytes = version === PERSISTENCE_V1_VERSION ? PERSISTENCE_V1_HEADER_BYTES : PERSISTENCE_HEADER_BYTES;
  const bodyBytesExpected = version === PERSISTENCE_V1_VERSION ? V1_BODY_BYTES : V2_BODY_BYTES;
  if (view.getUint16(6, true) !== headerBytes) throw corrupt("Invalid persistence header");
  const bodyBytes = view.getUint32(8, true);
  if (bodyBytes !== bodyBytesExpected || headerBytes + bodyBytes !== bytes.byteLength) throw corrupt("Invalid persistence length");
  if (view.getUint32(12, true) !== crc32(bytes)) throw corrupt("Invalid persistence checksum");
  const expectedRuleset = version === PERSISTENCE_V1_VERSION ? 1 : RULESET_VERSION;
  if (view.getUint16(16, true) !== expectedRuleset || view.getUint16(18, true) !== WORLD_WIDTH || view.getUint16(20, true) !== WORLD_HEIGHT || view.getUint16(22, true) !== 0) throw corrupt("Invalid persistence dimensions");
  if (view.getUint32(48, true) !== MATERIAL_BYTES || view.getUint32(52, true) !== LIFETIME_BYTES) throw corrupt("Invalid persistence arrays");
  if (version === PERSISTENCE_VERSION && (view.getUint32(56, true) !== TEMPERATURE_BYTES)) throw corrupt("Invalid temperature array");
  const tick = safeBigInt(view.getBigUint64(24, true));
  const nextSequence = safeBigInt(view.getBigUint64(40, true));
  const material = bytes.slice(headerBytes, headerBytes + MATERIAL_BYTES);
  if (version === PERSISTENCE_V1_VERSION && material.some((value) => value > MaterialId.Smoke)) throw corrupt("Invalid v1 material");
  const lifetime = new Uint16Array(CELLS);
  for (let index = 0; index < CELLS; index += 1) lifetime[index] = view.getUint16(headerBytes + MATERIAL_BYTES + index * 2, true);
  const temperature = new Int16Array(CELLS);
  if (version === PERSISTENCE_VERSION) {
    for (let index = 0; index < CELLS; index += 1) temperature[index] = view.getInt16(headerBytes + MATERIAL_BYTES + LIFETIME_BYTES + index * 2, true);
  } else {
    for (let index = 0; index < CELLS; index += 1) temperature[index] = migratedTemperature(material[index]);
  }
  const snapshot: AuthoritativeSnapshot = {
    nextSequence,
    world: { rulesetVersion: RULESET_VERSION, width: WORLD_WIDTH, height: WORLD_HEIGHT, tick, seed: view.getUint32(32, true), randomState: view.getUint32(36, true), material, lifetime, temperature }
  };
  try { assertSnapshot(snapshot); } catch { throw corrupt("Invalid world snapshot"); }
  return snapshot;
}

export function snapshotToBase64(snapshot: AuthoritativeSnapshot): string { return bytesToBase64(encodeSnapshot(snapshot)); }

export function snapshotFromBase64(text: string): AuthoritativeSnapshot {
  if (text.length > MAX_ENCODED_TEXT_BYTES || text.length === 0 || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw invalid("Invalid persistence text");
  if (Math.floor(text.length * 3 / 4) > MAX_DECODED_BYTES) throw invalid("Persistence text is too large");
  let binary: string;
  try { binary = atob(text); } catch { throw invalid("Invalid Base64"); }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  try { return decodeSnapshot(bytes); } catch (error) { throw asPersistenceError(error, "invalid-input"); }
}

export function snapshotFromBase64Result(text: string): PersistenceResult<AuthoritativeSnapshot> {
  try { return { ok: true, value: snapshotFromBase64(text) }; } catch (error) { return { ok: false, error: asPersistenceError(error, "invalid-input") }; }
}

export function snapshotToBlob(snapshot: AuthoritativeSnapshot): Blob {
  const bytes = encodeSnapshot(snapshot);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
}

export async function snapshotFromBlob(blob: Blob): Promise<AuthoritativeSnapshot> {
  if (blob.size > MAX_DECODED_BYTES) throw invalid("Persistence file is too large");
  try { return decodeSnapshot(await blob.arrayBuffer()); } catch (error) { throw asPersistenceError(error, "invalid-input"); }
}

export async function snapshotFromBlobResult(blob: Blob): Promise<PersistenceResult<AuthoritativeSnapshot>> {
  try { return { ok: true, value: await snapshotFromBlob(blob) }; } catch (error) { return { ok: false, error: asPersistenceError(error, "invalid-input") }; }
}

export interface SnapshotReplacer { replaceWithRecovery(snapshot: AuthoritativeSnapshot): boolean; }

export type ApplyPersistenceResult = PersistenceResult<void>;

export function applyBase64Result(controller: SnapshotReplacer, text: string): ApplyPersistenceResult {
  const decoded = snapshotFromBase64Result(text);
  if (!decoded.ok) return decoded;
  return replaceSnapshot(controller, decoded.value);
}

export async function applyBlobResult(controller: SnapshotReplacer, blob: Blob): Promise<ApplyPersistenceResult> {
  const decoded = await snapshotFromBlobResult(blob);
  if (!decoded.ok) return decoded;
  return replaceSnapshot(controller, decoded.value);
}

export function applyBase64(controller: SnapshotReplacer, text: string): boolean {
  return applyBase64Result(controller, text).ok;
}

export async function applyBlob(controller: SnapshotReplacer, blob: Blob): Promise<boolean> {
  return (await applyBlobResult(controller, blob)).ok;
}

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
export type AutosaveLoadResult = PersistenceResult<AuthoritativeSnapshot> | { readonly ok: true; readonly value: null };

export function createAutosave(storage: StorageLike, key: string) {
  const loadResult = (): AutosaveLoadResult => {
    let text: string | null;
    try { text = storage.getItem(key); } catch { return { ok: false, error: invalid("Autosave storage is unavailable") }; }
    if (text === null) return { ok: true, value: null };
    const result = snapshotFromBase64Result(text);
    if (!result.ok && result.error.kind === "invalid-input") return { ok: false, error: corrupt(result.error.message) };
    return result;
  };
  return {
    save(snapshot: AuthoritativeSnapshot): boolean { try { storage.setItem(key, snapshotToBase64(snapshot)); return true; } catch { return false; } },
    loadResult,
    load(): AuthoritativeSnapshot | null {
      const result = loadResult();
      if (result.ok) return result.value;
      if (result.error.kind === "corrupt") { try { storage.removeItem(key); } catch { /* storage may be unavailable */ } }
      return null;
    },
    clear(): void { try { storage.removeItem(key); } catch { /* storage may be unavailable */ } }
  };
}

function assertSnapshot(snapshot: AuthoritativeSnapshot): void {
  if (!snapshot || !Number.isSafeInteger(snapshot.nextSequence) || snapshot.nextSequence < 0) throw new Error("Invalid sequence");
  if (!snapshot.world || snapshot.world.rulesetVersion !== RULESET_VERSION || snapshot.world.width !== WORLD_WIDTH || snapshot.world.height !== WORLD_HEIGHT || !Number.isSafeInteger(snapshot.world.tick) || snapshot.world.tick < 0) throw new Error("Invalid world metadata");
  if (snapshot.world.material.length !== CELLS || snapshot.world.lifetime.length !== CELLS || snapshot.world.temperature.length !== CELLS) throw new Error("Invalid array length");
  try { createSimulation(snapshot.world.seed).restore(snapshot.world); } catch { throw new Error("Invalid world snapshot"); }
}

function migratedTemperature(material: number): number {
  if (material === MaterialId.Fire) return FIRE_TEMPERATURE;
  if (material === MaterialId.Smoke) return SMOKE_TEMPERATURE;
  if (material === MaterialId.Ice) return ICE_TEMPERATURE;
  return AMBIENT_TEMPERATURE;
}

function writeMagic(bytes: Uint8Array): void { for (let index = 0; index < PERSISTENCE_MAGIC.length; index += 1) bytes[index] = PERSISTENCE_MAGIC.charCodeAt(index); }
function writeMetadata(view: DataView, snapshot: AuthoritativeSnapshot, ruleset: number): void {
  view.setUint16(16, ruleset, true); view.setUint16(18, snapshot.world.width, true); view.setUint16(20, snapshot.world.height, true); view.setUint16(22, 0, true);
  view.setBigUint64(24, BigInt(snapshot.world.tick), true); view.setUint32(32, snapshot.world.seed, true); view.setUint32(36, snapshot.world.randomState, true); view.setBigUint64(40, BigInt(snapshot.nextSequence), true);
}
function checkMagic(bytes: Uint8Array): void { for (let index = 0; index < PERSISTENCE_MAGIC.length; index += 1) if (bytes[index] !== PERSISTENCE_MAGIC.charCodeAt(index)) throw corrupt("Invalid persistence magic"); }
function safeBigInt(value: bigint): number { const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw corrupt("Unsafe persistence integer"); return number; }
function corrupt(message: string): PersistenceError { return new PersistenceError("corrupt", message); }
function unsupported(message: string): PersistenceError { return new PersistenceError("unsupported-version", message); }
function invalid(message: string): PersistenceError { return new PersistenceError("invalid-input", message); }
function asPersistenceError(error: unknown, fallback: PersistenceErrorKind): PersistenceError { return error instanceof PersistenceError ? error : new PersistenceError(fallback, error instanceof Error ? error.message : "Invalid persistence input"); }
function replaceSnapshot(controller: SnapshotReplacer, snapshot: AuthoritativeSnapshot): ApplyPersistenceResult {
  try {
    if (!controller.replaceWithRecovery(snapshot)) return { ok: false, error: invalid("Controller refused persistence replacement") };
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: invalid(error instanceof Error ? error.message : "Controller refused persistence replacement") };
  }
}
function bytesToBase64(bytes: Uint8Array): string { let output = ""; for (let offset = 0; offset < bytes.length; offset += 0x7ffe) output += btoa(String.fromCharCode(...bytes.subarray(offset, offset + 0x7ffe))); return output; }
function crc32(bytes: Uint8Array): number { let crc = MAX_UINT32; for (let index = 0; index < bytes.length; index += 1) { const byte = index >= 12 && index < 16 ? 0 : bytes[index]; crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ MAX_UINT32) >>> 0; }
