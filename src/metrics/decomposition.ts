import type { BinningOptions, BrierDecomposition, Sample } from '../types';
import { assertBins, assertSamples } from '../validation';
import { binSamples } from './_binning';

const DEFAULT_BINS = 10;

/**
 * Computes the Murphy (1973) decomposition of the Brier score into three terms:
 *
 * ```
 * brierScore = reliability - resolution + uncertainty
 * ```
 *
 * - **reliability** — sample-weighted mean squared gap between the mean forecast
 *   and the observed frequency within each bin (calibration error; lower is better).
 * - **resolution** — sample-weighted mean squared gap between each bin's observed
 *   frequency and the overall base rate (discrimination; higher is better).
 * - **uncertainty** — variance of the outcome, `baseRate * (1 - baseRate)`; a
 *   property of the data alone, independent of the forecasts.
 *
 * The identity holds exactly when forecasts are constant within each bin, and
 * approximately otherwise (the discrepancy is the within-bin variance of the
 * forecasts, which shrinks as `bins` grows). This mirrors the standard behaviour
 * of the binned Brier decomposition.
 *
 * @param samples Non-empty list of `{ p, outcome }` pairs.
 * @param opts    Optional settings. `bins` (default `10`) must be a positive integer.
 * @returns The `{ reliability, resolution, uncertainty }` components.
 * @throws {CalibrationError} if `samples` is invalid or `bins` is not a positive integer.
 */
export function brierDecomposition(
  samples: readonly Sample[],
  opts: BinningOptions = {},
): BrierDecomposition {
  assertSamples(samples);
  const bins = opts.bins ?? DEFAULT_BINS;
  assertBins(bins);

  const n = samples.length;
  const aggregates = binSamples(samples, bins);

  let totalOutcome = 0;
  for (const { sumOutcome } of aggregates) {
    totalOutcome += sumOutcome;
  }
  const baseRate = totalOutcome / n;

  let reliability = 0;
  let resolution = 0;
  for (const { count, sumP, sumOutcome } of aggregates) {
    if (count === 0) {
      continue;
    }
    const meanPredicted = sumP / count;
    const observedFrequency = sumOutcome / count;
    reliability += count * (meanPredicted - observedFrequency) ** 2;
    resolution += count * (observedFrequency - baseRate) ** 2;
  }

  return {
    reliability: reliability / n,
    resolution: resolution / n,
    uncertainty: baseRate * (1 - baseRate),
  };
}
