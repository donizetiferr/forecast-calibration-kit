/**
 * forecast-calibration-kit
 *
 * Metrics for evaluating probabilistic (binary) forecasts:
 * Brier score, log loss, calibration curve, Expected Calibration Error (ECE),
 * and the Murphy decomposition of the Brier score.
 *
 * @packageDocumentation
 */

export type {
  BinaryOutcome,
  Sample,
  BinningOptions,
  LogLossOptions,
  CalibrationBin,
  BrierDecomposition,
} from './types';

export { CalibrationError } from './validation';

export { brierScore } from './metrics/brier';
export { logLoss } from './metrics/logLoss';
export { calibrationCurve, expectedCalibrationError } from './metrics/calibration';
export { brierDecomposition } from './metrics/decomposition';
