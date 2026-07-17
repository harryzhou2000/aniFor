import { describe, expect, it } from "vitest";
import { createSandboxController } from "../../src/app";
import { MaterialId } from "../../src/simulation/contracts";
import {
  MAX_DECODED_BYTES, MAX_ENCODED_TEXT_BYTES, applyBase64, applyBase64Result, applyBlobResult, createAutosave, decodeSnapshot,
  encodeSnapshot, PersistenceError, snapshotFromBase64, snapshotFromBlob, snapshotToBase64, snapshotToBlob
} from "../../src/persistence";
import { createSimulation } from "../../src/simulation/engine";
import { worldHash } from "../../src/simulation/hash";

function fixture() {
  const source = createSimulation(101).snapshot();
  return { nextSequence: 4, world: { ...source, material: source.material.slice(), lifetime: source.lifetime.slice() } };
}

const HEADER_BYTES = 60;
const MATERIAL_BYTES = 256 * 192;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = index >= 12 && index < 16 ? 0 : bytes[index];
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function withValidBody(mutator: (bytes: Uint8Array, view: DataView) => void): Uint8Array {
  const bytes = encodeSnapshot(fixture());
  const view = new DataView(bytes.buffer);
  mutator(bytes, view);
  view.setUint32(12, crc32(bytes), true);
  return bytes;
}

function v1Fixture(): Uint8Array {
  const original = fixture();
  original.world.material[0] = MaterialId.Fire;
  original.world.lifetime[0] = 90;
  original.world.material[1] = MaterialId.Smoke;
  original.world.lifetime[1] = 120;
  const bytes = new Uint8Array(56 + MATERIAL_BYTES + MATERIAL_BYTES * 2);
  const view = new DataView(bytes.buffer);
  bytes.set([65, 78, 73, 70]);
  view.setUint16(4, 1, true); view.setUint16(6, 56, true); view.setUint32(8, bytes.length - 56, true); view.setUint32(12, 0, true);
  view.setUint16(16, 1, true); view.setUint16(18, 256, true); view.setUint16(20, 192, true); view.setUint16(22, 0, true);
  view.setBigUint64(24, BigInt(original.world.tick), true); view.setUint32(32, original.world.seed, true); view.setUint32(36, original.world.randomState, true); view.setBigUint64(40, BigInt(original.nextSequence), true);
  view.setUint32(48, MATERIAL_BYTES, true); view.setUint32(52, MATERIAL_BYTES * 2, true);
  bytes.set(original.world.material, 56);
  for (let index = 0; index < MATERIAL_BYTES; index += 1) view.setUint16(56 + MATERIAL_BYTES + index * 2, original.world.lifetime[index], true);
  view.setUint32(12, crc32(bytes), true);
  return bytes;
}

function base64(bytes: Uint8Array): string {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 0x7ffe) text += btoa(String.fromCharCode(...bytes.subarray(offset, offset + 0x7ffe)));
  return text;
}

describe("Phase 3A persistence", () => {
  it("migrates the committed v1 envelope to canonical v2 temperature state", () => {
    const migrated = decodeSnapshot(v1Fixture());
    expect(migrated.world.rulesetVersion).toBe(2);
    expect(migrated.world.material[0]).toBe(MaterialId.Fire);
    expect(migrated.world.material[1]).toBe(MaterialId.Smoke);
    expect(migrated.world.temperature[0]).toBe(1400);
    expect(migrated.world.temperature[1]).toBe(500);
    expect(migrated.world.temperature[2]).toBe(200);
    expect(worldHash(migrated.world)).toBe("ce4164cb");
    expect(decodeSnapshot(encodeSnapshot(migrated))).toEqual(migrated);
    const resumed = createSimulation(migrated.world.seed);
    resumed.restore(migrated.world);
    const replay = createSimulation(migrated.world.seed);
    replay.restore(decodeSnapshot(v1Fixture()).world);
    for (let index = 0; index < 4; index += 1) { resumed.advanceTick(); replay.advanceTick(); }
    expect(worldHash(resumed.snapshot())).toBe(worldHash(replay.snapshot()));
  });

  it("classifies unsupported versions and preserves them in autosave storage", () => {
    const bytes = encodeSnapshot(fixture());
    new DataView(bytes.buffer).setUint16(4, 3, true);
    let stored = base64(bytes);
    const values = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; }, removeItem: () => { stored = "removed"; } };
    const autosave = createAutosave(values, "sandbox");
    const result = autosave.loadResult();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(PersistenceError);
    expect(autosave.load()).toBeNull();
    expect(stored).not.toBe("removed");
  });

  it("preserves little-endian signed temperature payloads and migrates autosaves", () => {
    const original = fixture();
    original.world.temperature[0] = -50;
    original.world.temperature[1] = 1400;
    const encoded = encodeSnapshot(original);
    const temperatureOffset = HEADER_BYTES + MATERIAL_BYTES + MATERIAL_BYTES * 2;
    expect(encoded[temperatureOffset]).toBe(0xce);
    expect(encoded[temperatureOffset + 1]).toBe(0xff);
    expect(decodeSnapshot(encoded).world.temperature.slice(0, 2)).toEqual(new Int16Array([-50, 1400]));
    const values = new Map<string, string>([["sandbox", base64(v1Fixture())]]);
    const autosave = createAutosave({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, "sandbox");
    const migrated = autosave.loadResult();
    expect(migrated.ok).toBe(true);
    if (migrated.ok && migrated.value) expect(migrated.value.world.rulesetVersion).toBe(2);
  });

  it("round-trips canonical text and Blob forms defensively", async () => {
    const original = fixture();
    const text = snapshotToBase64(original);
    const fromText = snapshotFromBase64(text);
    const fromBlob = await snapshotFromBlob(snapshotToBlob(original));
    expect(fromText).toEqual(original);
    expect(fromBlob).toEqual(original);
    fromText.world.material[0] = MaterialId.Wall;
    expect(original.world.material[0]).toBe(MaterialId.Empty);
  });

  it("supports deterministic save-resume and recovery after apply", () => {
    const source = createSandboxController({ seed: 12 });
    source.dispatch({ type: "pause", paused: true });
    source.paint({ tool: "sand", radius: 0, points: [{ x: 20, y: 20 }] });
    const saved = source.snapshot();
    const target = createSandboxController({ seed: 99 });
    const before = target.snapshot();
    expect(applyBase64(target, snapshotToBase64(saved))).toBe(true);
    expect(target.snapshot()).toEqual(saved);
    expect(target.recover()).toBe(true);
    expect(target.snapshot()).toEqual(before);
  });

  it("rejects malformed, oversized, and structurally invalid input", async () => {
    expect(() => snapshotFromBase64("not base64!")).toThrow();
    expect(() => snapshotFromBase64("A".repeat(MAX_ENCODED_TEXT_BYTES + 1))).toThrow();
    expect(() => decodeSnapshot(new Uint8Array(MAX_DECODED_BYTES + 1))).toThrow();
    const encoded = encodeSnapshot(fixture());
    const badMagic = encoded.slice(); badMagic[0] ^= 1;
    expect(() => decodeSnapshot(badMagic)).toThrow();
    const badHeader = encoded.slice(); new DataView(badHeader.buffer).setUint16(6, 1, true);
    expect(() => decodeSnapshot(badHeader)).toThrow();
    const badLength = encoded.slice(); new DataView(badLength.buffer).setUint32(8, 1, true);
    expect(() => decodeSnapshot(badLength)).toThrow();
    const badChecksum = encoded.slice(); badChecksum[56] ^= 1;
    expect(() => decodeSnapshot(badChecksum)).toThrow();
    for (const offset of [24, 32, 36, 40]) {
      const badMetadata = encoded.slice();
      badMetadata[offset] ^= 1;
      expect(() => decodeSnapshot(badMetadata)).toThrow();
    }
    const badRuleset = encoded.slice(); new DataView(badRuleset.buffer).setUint16(16, 1, true);
    expect(() => decodeSnapshot(badRuleset)).toThrow();
    const badWidth = encoded.slice(); new DataView(badWidth.buffer).setUint16(18, 255, true);
    expect(() => decodeSnapshot(badWidth)).toThrow();
    const badHeight = encoded.slice(); new DataView(badHeight.buffer).setUint16(20, 191, true);
    expect(() => decodeSnapshot(badHeight)).toThrow();
    const badTick = encoded.slice(); new DataView(badTick.buffer).setBigUint64(24, 0x20000000000000n, true);
    expect(() => decodeSnapshot(badTick)).toThrow();
    const badSequence = encoded.slice(); new DataView(badSequence.buffer).setBigUint64(40, 0x20000000000000n, true);
    expect(() => decodeSnapshot(badSequence)).toThrow();
    const unknownMaterial = withValidBody((bytes) => { bytes[HEADER_BYTES] = 255; });
    expect(() => decodeSnapshot(unknownMaterial)).toThrow();
    const staticLifetime = withValidBody((bytes, view) => { bytes[HEADER_BYTES] = MaterialId.Wall; view.setUint16(HEADER_BYTES + MATERIAL_BYTES, 1, true); });
    expect(() => decodeSnapshot(staticLifetime)).toThrow();
    const fireLifetime = withValidBody((bytes) => { bytes[HEADER_BYTES] = MaterialId.Fire; });
    expect(() => decodeSnapshot(fireLifetime)).toThrow();
    const smokeLifetime = withValidBody((bytes) => { bytes[HEADER_BYTES] = MaterialId.Smoke; });
    expect(() => decodeSnapshot(smokeLifetime)).toThrow();
    const endianFixture = fixture();
    endianFixture.world.material[0] = MaterialId.Fire;
    endianFixture.world.lifetime[0] = 0x0010;
    const endianBytes = encodeSnapshot(endianFixture);
    expect(endianBytes[HEADER_BYTES + MATERIAL_BYTES]).toBe(0x10);
    expect(endianBytes[HEADER_BYTES + MATERIAL_BYTES + 1]).toBe(0x00);
    expect(decodeSnapshot(endianBytes).world.lifetime[0]).toBe(0x0010);
    const valid = fixture();
    const badMaterial = { nextSequence: valid.nextSequence, world: { ...valid.world, material: new Uint8Array(1) } } as any;
    expect(() => encodeSnapshot(badMaterial)).toThrow();
    const badLifetime = fixture(); badLifetime.world.material[0] = MaterialId.Fire; badLifetime.world.lifetime[0] = 0;
    expect(() => encodeSnapshot(badLifetime)).toThrow();
    await expect(snapshotFromBlob(new Blob([new Uint8Array(MAX_DECODED_BYTES + 1)]))).rejects.toThrow();
  });

  it("applies failed input atomically", () => {
    const controller = createSandboxController({ seed: 33 });
    controller.dispatch({ type: "pause", paused: true });
    controller.paint({ tool: "wall", radius: 0, points: [{ x: 4, y: 4 }] });
    const before = controller.snapshot();
    expect(applyBase64(controller, "bad!" )).toBe(false);
    expect(controller.snapshot()).toEqual(before);
    expect(controller.canRecover).toBe(false);
  });

  it("returns typed import failures without mutating the controller", async () => {
    const controller = createSandboxController({ seed: 33 });
    controller.dispatch({ type: "pause", paused: true });
    controller.paint({ tool: "wall", radius: 0, points: [{ x: 4, y: 4 }] });
    const before = controller.snapshot();

    const unsupported = encodeSnapshot(fixture());
    new DataView(unsupported.buffer).setUint16(4, 3, true);
    const unsupportedResult = await applyBlobResult(controller, new Blob([unsupported.buffer as ArrayBuffer]));
    expect(unsupportedResult.ok).toBe(false);
    if (!unsupportedResult.ok) expect(unsupportedResult.error.kind).toBe("unsupported-version");

    const corrupt = encodeSnapshot(fixture());
    corrupt[60] ^= 1;
    const corruptResult = applyBase64Result(controller, base64(corrupt));
    expect(corruptResult.ok).toBe(false);
    if (!corruptResult.ok) expect(corruptResult.error.kind).toBe("corrupt");

    const invalidResult = applyBase64Result(controller, "bad!");
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) expect(invalidResult.error.kind).toBe("invalid-input");
    expect(controller.snapshot()).toEqual(before);
    expect(controller.canRecover).toBe(false);
  });

  it("returns success after atomic replacement and classifies controller refusal", () => {
    const source = fixture();
    const controller = createSandboxController({ seed: 99 });
    const result = applyBase64Result(controller, snapshotToBase64(source));
    expect(result).toEqual({ ok: true, value: undefined });
    expect(controller.snapshot()).toEqual(source);

    const refusal = applyBase64Result({ replaceWithRecovery: () => false }, snapshotToBase64(source));
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.error.kind).toBe("invalid-input");
  });

  it("handles corrupt autosave entries and storage failures", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const autosave = createAutosave(storage, "sandbox");
    const original = fixture();
    expect(autosave.save(original)).toBe(true);
    expect(autosave.load()).toEqual(original);
    values.set("sandbox", "corrupt");
    expect(autosave.load()).toBeNull();
    expect(values.has("sandbox")).toBe(false);
    const failing = createAutosave({ getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("security"); } }, "sandbox");
    expect(failing.save(original)).toBe(false);
    expect(failing.load()).toBeNull();
    failing.clear();
  });
});
