import { describe, expect, it } from "vitest";
import { createSandboxController } from "../../src/app";
import { MaterialId } from "../../src/simulation/contracts";
import {
  MAX_DECODED_BYTES, MAX_ENCODED_TEXT_BYTES, applyBase64, createAutosave, decodeSnapshot,
  encodeSnapshot, snapshotFromBase64, snapshotFromBlob, snapshotToBase64, snapshotToBlob
} from "../../src/persistence";
import { createSimulation } from "../../src/simulation/engine";

function fixture() {
  const source = createSimulation(101).snapshot();
  return { nextSequence: 4, world: { ...source, material: source.material.slice(), lifetime: source.lifetime.slice() } };
}

const HEADER_BYTES = 56;
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

describe("Phase 3A persistence", () => {
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
    const badRuleset = encoded.slice(); new DataView(badRuleset.buffer).setUint16(16, 2, true);
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
