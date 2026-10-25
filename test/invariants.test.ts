import { describe, expect, it } from 'vitest';
import {
  brierDecomposition,
  brierScore,
  calibrationCurve,
  expectedCalibrationError,
  logLoss,
  type CalibrationBin,
  type Sample,
} from '../src/index';

/** Small dyadic probabilities make the direct Brier-score calculation exact. */
function dataset(seed: number): readonly Sample[] {
  let state = seed;
  return Object.freeze(
    Array.from({ length: 1 + (seed % 32) }, (): Sample => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return Object.freeze({
        p: ((state >>> 24) % 17) / 16,
        outcome: (state & 256) === 0 ? 0 : 1,
      });
    }),
  );
}

/** Assigns bins by interval membership, independently of the production helper. */
function referenceCurve(samples: readonly Sample[], bins: number): CalibrationBin[] {
  const curve: CalibrationBin[] = [];
  for (let index = 0; index < bins; index++) {
    const members = samples.filter(
      ({ p }) => p >= index / bins && (p < (index + 1) / bins || (index === bins - 1 && p === 1)),
    );
    if (members.length === 0) continue;
    curve.push({
      binMidpoint: (index + 0.5) / bins,
      meanPredicted: members.reduce((total, { p }) => total + p, 0) / members.length,
      observedFrequency:
        members.reduce((total, { outcome }) => total + outcome, 0) / members.length,
      count: members.length,
    });
  }
  return curve;
}

describe('cross-metric mathematical invariants', () => {
  it.each([1, 2, 4, 8])('matches independent calculations with %i bins', (bins) => {
    for (let seed = 1; seed <= 128; seed++) {
      const samples = dataset(seed);
      const n = samples.length;
      const context = `seed=${seed}, bins=${bins}`;
      const baseRate = samples.reduce((total, { outcome }) => total + outcome, 0) / n;
      const expectedCurve = referenceCurve(samples, bins);
      expect(calibrationCurve(samples, { bins }), context).toEqual(expectedCurve);

      const directScore =
        samples.reduce((total, { p, outcome }) => total + (p - outcome) ** 2, 0) / n;
      expect(brierScore(samples), context).toBe(directScore);

      // A dyadic clamp avoids subtractive cancellation in this simple oracle.
      const eps = 0.125;
      const directLoss =
        samples.reduce((total, { p, outcome }) => {
          const clamped = Math.max(eps, Math.min(1 - eps, p));
          return total - Math.log(outcome === 1 ? clamped : 1 - clamped);
        }, 0) / n;
      expect(logLoss(samples, { eps }), context).toBeCloseTo(directLoss, 14);

      const gap = expectedCurve.reduce(
        (total, bin) => total + bin.count * Math.abs(bin.meanPredicted - bin.observedFrequency),
        0,
      );
      expect(expectedCalibrationError(samples, { bins }), context).toBeCloseTo(gap / n, 14);

      const expectedReliability =
        expectedCurve.reduce(
          (total, bin) => total + bin.count * (bin.meanPredicted - bin.observedFrequency) ** 2,
          0,
        ) / n;
      const expectedResolution =
        expectedCurve.reduce(
          (total, bin) => total + bin.count * (bin.observedFrequency - baseRate) ** 2,
          0,
        ) / n;
      const { reliability, resolution, uncertainty } = brierDecomposition(samples, { bins });
      expect(reliability, context).toBeCloseTo(expectedReliability, 14);
      expect(resolution, context).toBeCloseTo(expectedResolution, 14);
      expect(uncertainty, context).toBeCloseTo(baseRate * (1 - baseRate), 14);

      const binMeanScore =
        expectedCurve.reduce((total, bin) => {
          const positives = bin.observedFrequency * bin.count;
          return (
            total +
            positives * (1 - bin.meanPredicted) ** 2 +
            (bin.count - positives) * bin.meanPredicted ** 2
          );
        }, 0) / n;
      expect(reliability - resolution + uncertainty, context).toBeCloseTo(binMeanScore, 14);
    }
  });
});
