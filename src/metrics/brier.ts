import type { Sample } from '../types';
import { assertSamples } from '../validation';

/**
 * Computes the Brier score: the mean squared error between forecast
 * probabilities and binary outcomes.
 *
 * ```
 * BS = (1 / N) * Σ (p_i - outcome_i)^2
 * ```
 *
 * The score lies in `[0, 1]`; lower is better. A perfect deterministic forecaster
 * (probabilities of exactly `0` or `1` matching every outcome) scores `0`, while a
 * constant `0.5` forecaster always scores `0.25`.
 *
 * @param samples Non-empty list of `{ p, outcome }` pairs.
 * @returns The Brier score.
 * @throws {CalibrationError} if `samples` is empty or contains invalid entries.
 */
export function brierScore(samples: readonly Sample[]): number {
  assertSamples(samples);
  let sum = 0;
  for (const { p, outcome } of samples) {
    const diff = p - outcome;
    sum += diff * diff;
  }
  return sum / samples.length;
}
