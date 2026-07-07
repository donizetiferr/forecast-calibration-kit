import type { Sample } from './types';

/**
 * Error thrown when inputs to a calibration metric are invalid.
 */
export class CalibrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalibrationError';
  }
}

/**
 * Validates a list of samples at the API boundary.
 *
 * Ensures the list is a non-empty array and that every element has a probability
 * `p` in `[0, 1]` and an `outcome` that is exactly `0` or `1`.
 *
 * @throws {CalibrationError} if the input is not a non-empty array of valid samples.
 */
export function assertSamples(samples: readonly Sample[]): void {
  if (!Array.isArray(samples)) {
    throw new CalibrationError('samples must be an array of { p, outcome } objects.');
  }
  if (samples.length === 0) {
    throw new CalibrationError(
      'samples must not be empty; at least one { p, outcome } is required.',
    );
  }
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample === null || typeof sample !== 'object') {
      throw new CalibrationError(`samples[${i}] must be an object with { p, outcome }.`);
    }
    const { p, outcome } = sample;
    if (typeof p !== 'number' || Number.isNaN(p) || p < 0 || p > 1) {
      throw new CalibrationError(
        `samples[${i}].p must be a number in [0, 1], received ${stringify(p)}.`,
      );
    }
    if (outcome !== 0 && outcome !== 1) {
      throw new CalibrationError(
        `samples[${i}].outcome must be 0 or 1, received ${stringify(outcome)}.`,
      );
    }
  }
}

/**
 * Validates the `bins` option: must be a positive integer.
 *
 * @throws {CalibrationError} if `bins` is not a positive integer.
 */
export function assertBins(bins: number): void {
  if (typeof bins !== 'number' || !Number.isInteger(bins) || bins < 1) {
    throw new CalibrationError(`bins must be a positive integer, received ${stringify(bins)}.`);
  }
}

/**
 * Validates the `eps` option for {@link logLoss}: must be in the open interval `(0, 0.5)`.
 *
 * @throws {CalibrationError} if `eps` is out of range.
 */
export function assertEps(eps: number): void {
  if (typeof eps !== 'number' || Number.isNaN(eps) || eps <= 0 || eps >= 0.5) {
    throw new CalibrationError(`eps must be a number in (0, 0.5), received ${stringify(eps)}.`);
  }
}

function stringify(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return Object.prototype.toString.call(value);
}
