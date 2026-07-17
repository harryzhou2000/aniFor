import type { WorldSnapshot } from "./contracts";

/** Stable FNV-1a hash intended for tests and replay diagnostics only. */
export function worldHash(snapshot: WorldSnapshot): string {
  let h = 2166136261 >>> 0;
  const add = (v: number) => { h ^= v & 255; h = Math.imul(h, 16777619) >>> 0; };
  const add32 = (v: number) => { add(v); add(v >>> 8); add(v >>> 16); add(v >>> 24); };
  add32(snapshot.rulesetVersion); add32(snapshot.width); add32(snapshot.height);
  // Tick is a safe integer rather than a uint32; retain its high portion too.
  add32(snapshot.tick >>> 0);
  add32(Math.floor(snapshot.tick / 0x100000000));
  add32(snapshot.seed); add32(snapshot.randomState);
  for (let i = 0; i < snapshot.material.length; i++) { add(snapshot.material[i]); add(snapshot.lifetime[i]); add(snapshot.lifetime[i] >>> 8); }
  return h.toString(16).padStart(8, "0");
}
