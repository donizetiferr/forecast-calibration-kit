import type { BinningOptions, CalibrationBin, Sample } from '../types';
import { assertBins, assertSamples } from '../validation';
import { binMidpoint, binSamples } from './_binning';

const DEFAULT_BINS = 10;

/**
 * Builds a calibration curve (reliability diagram) by grouping forecasts into
 * equal-width probability bins.
 *
 * For each bin that contains at least one sample, returns the mean forecast
 * probability (`meanPredicted`) and the observed frequency of positive outcomes
 * (`observedFrequency`). On a perfectly calibrated forecaster these two are equal
 * within every bin, so the points lie on the diagonal.
 *
 * Empty bins are omitted from the result, so the returned array may be shorter
 * than `bins`.
 *
 * @param samples Non-empty list of `{ p, outcome }` pairs.
 * @param opts    Optional settings. `bins` (default `10`) must be a positive integer.
 * @returns One {@link CalibrationBin} per non-empty bin, ordered by increasing probability.
 * @throws {CalibrationError} if `samples` is invalid or `bins` is not a positive integer.
 */
export function calibrationCurve(
  samples: readonly Sample[],
  opts: BinningOptions = {},
): CalibrationBin[] {
  assertSamples(samples);
  const bins = opts.bins ?? DEFAULT_BINS;
  assertBins(bins);

  const aggregates = binSamples(samples, bins);
  const curve: CalibrationBin[] = [];
  for (let i = 0; i < aggregates.length; i++) {
    const { count, sumP, sumOutcome } = aggregates[i]!;
    if (count === 0) {
      continue;
    }
    curve.push({
      binMidpoint: binMidpoint(i, bins),
      meanPredicted: sumP / count,
      observedFrequency: sumOutcome / count,
      count,
    });
  }
  return curve;
}

/**
 * Computes the Expected Calibration Error (ECE): the sample-weighted average gap
 * between forecast confidence and observed frequency across probability bins.
 *
 * ```
 * ECE = Σ_bins (count_b / N) * | meanPredicted_b - observedFrequency_b |
 * ```
 *
 * The result lies in `[0, 1]`; `0` means every bin is perfectly calibrated.
 *
 * @param samples Non-empty list of `{ p, outcome }` pairs.
 * @param opts    Optional settings. `bins` (default `10`) must be a positive integer.
 * @returns The expected calibration error.
 * @throws {CalibrationError} if `samples` is invalid or `bins` is not a positive integer.
 */
export function expectedCalibrationError(
  samples: readonly Sample[],
  opts: BinningOptions = {},
): number {
  assertSamples(samples);
  const bins = opts.bins ?? DEFAULT_BINS;
  assertBins(bins);

  const n = samples.length;
  const aggregates = binSamples(samples, bins);
  let ece = 0;
  for (const { count, sumP, sumOutcome } of aggregates) {
    if (count === 0) {
      continue;
    }
    const meanPredicted = sumP / count;
    const observedFrequency = sumOutcome / count;
    ece += (count / n) * Math.abs(meanPredicted - observedFrequency);
  }
  return ece;
}
