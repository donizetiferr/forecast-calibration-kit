import type { LogLossOptions, Sample } from '../types';
import { assertEps, assertOptions, assertSamples } from '../validation';
import { CompensatedSum } from './_sum';

const DEFAULT_EPS = 1e-15;

/**
 * Computes the logarithmic loss (a.k.a. binary cross-entropy / log score).
 *
 * ```
 * LL = -(1 / N) * Σ [ outcome_i * ln(p_i) + (1 - outcome_i) * ln(1 - p_i) ]
 * ```
 *
 * Probabilities are clamped to `[eps, 1 - eps]` before taking logarithms so that
 * confident-but-wrong forecasts (`p = 0` or `p = 1`) yield a large finite penalty
 * instead of `Infinity`. Lower is better. A constant `0.5` forecaster scores
 * `ln(2) ≈ 0.6931`.
 *
 * @param samples Non-empty list of `{ p, outcome }` pairs.
 * @param opts    Optional settings. `eps` (default `1e-15`) must lie in `(0, 0.5)`.
 * @returns The mean log loss.
 * @throws {CalibrationError} if `samples` is invalid or `eps` is out of range.
 */
export function logLoss(samples: readonly Sample[], opts: LogLossOptions = {}): number {
  assertSamples(samples);
  assertOptions(opts);
  const eps = opts.eps === undefined ? DEFAULT_EPS : opts.eps;
  assertEps(eps);

  const sum = new CompensatedSum();
  for (const { p, outcome } of samples) {
    // Work with the smaller tail directly: forming 1 - eps can round to 1,
    // and subtracting a probability near 1 loses precision even for default eps.
    if (p <= 0.5) {
      const tail = Math.max(p, eps);
      sum.add(outcome === 1 ? -Math.log(tail) : -Math.log1p(-tail));
    } else {
      const tail = Math.max(1 - p, eps);
      sum.add(outcome === 1 ? -Math.log1p(-tail) : -Math.log(tail));
    }
  }
  return sum.value() / samples.length;
}
