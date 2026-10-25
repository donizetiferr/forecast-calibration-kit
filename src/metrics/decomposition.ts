import type { BinningOptions, BrierDecomposition, Sample } from '../types';
import { assertBins, assertOptions, assertSamples } from '../validation';
import { binSamples } from './_binning';
import { CompensatedSum } from './_sum';

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
 * The reconstruction is the Brier score of forecasts replaced by their bin
 * means. It equals the original score when forecasts are constant within each
 * bin. Otherwise, original score - reconstruction is the sample-weighted sum
 * of Var(p | bin) - 2 * Cov(p, outcome | bin), and may have either sign.
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
  assertOptions(opts);
  const bins = opts.bins === undefined ? DEFAULT_BINS : opts.bins;
  assertBins(bins);

  const n = samples.length;
  const aggregates = binSamples(samples, bins);

  let totalOutcome = 0;
  for (const { sumOutcome } of aggregates) {
    totalOutcome += sumOutcome;
  }
  const baseRate = totalOutcome / n;
  const negativeRate = (n - totalOutcome) / n;
  const useNegativeOutcomes = totalOutcome > n / 2;

  const reliability = new CompensatedSum();
  const resolution = new CompensatedSum();
  for (const { count, meanPredicted, sumOutcome } of aggregates) {
    const observedFrequency = sumOutcome / count;
    reliability.add(count * (meanPredicted - observedFrequency) ** 2);
    // Resolution is unchanged by exchanging the labels. Use the rarer outcome
    // to avoid subtracting two frequencies close to one in imbalanced data.
    const deviation = useNegativeOutcomes
      ? (count - sumOutcome) / count - negativeRate
      : observedFrequency - baseRate;
    resolution.add(count * deviation ** 2);
  }

  return {
    reliability: reliability.value() / n,
    resolution: resolution.value() / n,
    uncertainty: baseRate * negativeRate,
  };
}
