/**
 * A binary outcome: `1` if the event occurred, `0` otherwise.
 */
export type BinaryOutcome = 0 | 1;

/**
 * A single probabilistic forecast paired with the realized outcome.
 *
 * @property p       Forecast probability of the positive class, in the closed interval `[0, 1]`.
 * @property outcome Realized binary outcome (`0` or `1`).
 */
export interface Sample {
  p: number;
  outcome: BinaryOutcome;
}

/**
 * Options that control how forecasts are grouped into probability bins.
 */
export interface BinningOptions {
  /**
   * Number of equal-width bins over the `[0, 1]` probability range.
   * Must be a positive integer. Defaults to `10`.
   */
  bins?: number;
}

/**
 * Options for {@link logLoss}.
 */
export interface LogLossOptions {
  /**
   * Small value used to clamp probabilities away from `0` and `1`, avoiding
   * `log(0)`. Must lie in the open interval `(0, 0.5)`. Defaults to `1e-15`.
   */
  eps?: number;
}

/**
 * A single point of a reliability diagram (calibration curve).
 *
 * @property binMidpoint       Nominal midpoint of the bin, in `[0, 1]`.
 * @property meanPredicted     Mean forecast probability among samples in the bin.
 * @property observedFrequency Observed fraction of positive outcomes in the bin.
 * @property count             Number of samples that fell into the bin (always `> 0`).
 */
export interface CalibrationBin {
  binMidpoint: number;
  meanPredicted: number;
  observedFrequency: number;
  count: number;
}

/**
 * The Murphy decomposition of the Brier score.
 *
 * The three terms satisfy the identity
 * `brierScore = reliability - resolution + uncertainty` (exactly when forecasts
 * are constant within each bin; approximately otherwise).
 *
 * @property reliability Weighted mean squared gap between forecast and observed
 *                       frequency per bin. Lower is better (0 = perfectly calibrated bins).
 * @property resolution  Weighted mean squared gap between per-bin observed frequency
 *                       and the overall base rate. Higher is better (more discriminative).
 * @property uncertainty Variance of the outcome, `baseRate * (1 - baseRate)`. Intrinsic to
 *                       the data and independent of the forecasts.
 */
export interface BrierDecomposition {
  reliability: number;
  resolution: number;
  uncertainty: number;
}
