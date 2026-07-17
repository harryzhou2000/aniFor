/** Small, portable PRNG.  All callers use integer state and thresholds. */
export class FixedRandom {
  seed: number;
  private value: number;

  constructor(seed = 0x6d2b79f5, state = seed) {
    this.seed = seed >>> 0;
    this.value = state >>> 0;
  }

  get state(): number { return this.value >>> 0; }
  set state(value: number) { this.value = value >>> 0; }

  next(): number {
    let x = this.value || 0x6d2b79f5;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.value = x >>> 0;
    return this.value;
  }

  bit(): number { return this.next() & 1; }
  below(threshold: number): boolean { return (this.next() >>> 0) < (threshold >>> 0); }
}
