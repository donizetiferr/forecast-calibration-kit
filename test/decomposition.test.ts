import { describe, expect, it } from 'vitest';
import { brierDecomposition, brierScore, CalibrationError, type Sample } from '../src/index';

/** Builds a dataset whose forecasts are constant within each bin (p = bin midpoint). */
function constantWithinBinSamples(
  bins: number,
  plan: ReadonlyArray<readonly [binIndex: number, positives: number, negatives: number]>,
): Sample[] {
  const samples: Sample[] = [];
  for (const [binIndex, positives, negatives] of plan) {
    const p = (binIndex + 0.5) / bins;
    for (let k = 0; k < positives; k++) {
      samples.push({ p, outcome: 1 });
    }
    for (let k = 0; k < negatives; k++) {
      samples.push({ p, outcome: 0 });
    }
  }
  return samples;
}

describe('brierDecomposition', () => {
  it('matches hand-computed reliability / resolution / uncertainty', () => {
    // bin5: p=0.5 x2 (one hit, one miss) ; bin9: p=1.0 x1 (hit). baseRate = 2/3.
    const samples: Sample[] = [
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 0 },
      { p: 1, outcome: 1 },
    ];
    const { reliability, resolution, uncertainty } = brierDecomposition(samples, { bins: 10 });
    expect(reliability).toBeCloseTo(0, 12);
    expect(resolution).toBeCloseTo(0.05555555555555557, 12);
    expect(uncertainty).toBeCloseTo(0.2222222222222222, 12);
  });

  it('satisfies the Murphy identity Brier = reliability - resolution + uncertainty (exact within a bin)', () => {
    const bins = 10;
    const samples = constantWithinBinSamples(bins, [
      [0, 1, 4],
      [2, 3, 2],
      [5, 4, 1],
      [8, 5, 0],
      [9, 2, 3],
    ]);
    const { reliability, resolution, uncertainty } = brierDecomposition(samples, { bins });
    const reconstructed = reliability - resolution + uncertainty;
    expect(Math.abs(reconstructed - brierScore(samples))).toBeLessThan(1e-9);
  });

  it('keeps the identity exact across several bin resolutions', () => {
    for (const bins of [2, 4, 5, 20]) {
      const samples = constantWithinBinSamples(bins, [
        [0, 2, 3],
        [1, 4, 1],
        [bins - 1, 3, 3],
      ]);
      const { reliability, resolution, uncertainty } = brierDecomposition(samples, { bins });
      const reconstructed = reliability - resolution + uncertainty;
      expect(Math.abs(reconstructed - brierScore(samples))).toBeLessThan(1e-9);
    }
  });

  it('reports zero uncertainty when every outcome is identical', () => {
    const samples: Sample[] = [
      { p: 0.3, outcome: 1 },
      { p: 0.7, outcome: 1 },
    ];
    expect(brierDecomposition(samples).uncertainty).toBeCloseTo(0, 12);
  });

  it('returns non-negative reliability, resolution and uncertainty', () => {
    const samples = constantWithinBinSamples(10, [
      [1, 2, 3],
      [6, 5, 2],
    ]);
    const { reliability, resolution, uncertainty } = brierDecomposition(samples);
    expect(reliability).toBeGreaterThanOrEqual(0);
    expect(resolution).toBeGreaterThanOrEqual(0);
    expect(uncertainty).toBeGreaterThanOrEqual(0);
  });

  it('throws on invalid input', () => {
    expect(() => brierDecomposition([])).toThrow(CalibrationError);
    expect(() => brierDecomposition([{ p: 0.5, outcome: 1 }], { bins: 0 })).toThrow(
      CalibrationError,
    );
  });
});
