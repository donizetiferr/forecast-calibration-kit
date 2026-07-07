import type { LogLossOptions, Sample } from '../types';
import { assertEps, assertSamples } from '../validation';

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
  const eps = opts.eps ?? DEFAULT_EPS;
  assertEps(eps);

  let sum = 0;
  for (const { p, outcome } of samples) {
    const clamped = Math.min(Math.max(p, eps), 1 - eps);
    sum += outcome === 1 ? -Math.log(clamped) : -Math.log(1 - clamped);
  }
  return sum / samples.length;
}
