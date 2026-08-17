/**
 * Conservative governor for optional HDR presentation work. It consumes
 * elapsed GPU time only; CPU submission time and completion fences are not
 * equivalent measurements and must not silently lower visual quality.
 */
export type AdaptivePresentationQualityTier = 'full' | 'reduced' | 'minimal';

export interface AdaptivePresentationQualityUpdate {
  readonly tier: AdaptivePresentationQualityTier;
  readonly changed: boolean;
  readonly averageGpuMs: number;
}

const WINDOW = 6;
const ESCALATION_SAMPLES = 4;
const RECOVERY_SAMPLES = 12;

/**
 * Hysteretic GPU-time controller. Reduced retains the crisp bloom core; minimal
 * retains HDR material compositing but skips bloom. Simulation, fields,
 * material support, and camera state remain outside this controller.
 */
export class AdaptivePresentationQuality {
  private tier: AdaptivePresentationQualityTier = 'full';
  private readonly samples: number[] = [];
  private aboveBudget = 0;
  private belowBudget = 0;

  currentTier(): AdaptivePresentationQualityTier { return this.tier; }

  observeGpuMilliseconds(gpuMs: number): AdaptivePresentationQualityUpdate | undefined {
    if (!Number.isFinite(gpuMs) || gpuMs < 0) return undefined;
    this.samples.push(gpuMs);
    if (this.samples.length > WINDOW) this.samples.shift();
    const averageGpuMs = this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length;
    const overloaded = this.tier === 'full' ? averageGpuMs > 24
      : this.tier === 'reduced' ? averageGpuMs > 38 : false;
    const comfortablyFast = this.tier === 'minimal' ? averageGpuMs < 23
      : this.tier === 'reduced' ? averageGpuMs < 15 : false;
    this.aboveBudget = overloaded ? this.aboveBudget + 1 : 0;
    this.belowBudget = comfortablyFast ? this.belowBudget + 1 : 0;
    let next = this.tier;
    if (this.aboveBudget >= ESCALATION_SAMPLES) {
      next = this.tier === 'full' ? 'reduced' : 'minimal';
    } else if (this.belowBudget >= RECOVERY_SAMPLES) {
      next = this.tier === 'minimal' ? 'reduced' : 'full';
    }
    if (next === this.tier) return { tier: this.tier, changed: false, averageGpuMs };
    this.tier = next;
    this.aboveBudget = 0;
    this.belowBudget = 0;
    return { tier: this.tier, changed: true, averageGpuMs };
  }
}
