import { describe, expect, it } from 'vitest';
import {
  brierDecomposition,
  calibrationCurve,
  CalibrationError,
  expectedCalibrationError,
  logLoss,
  type BinningOptions,
  type LogLossOptions,
  type Sample,
} from '../src/index';
import { computeReport } from '../src/cli';

const samples: Sample[] = [{ p: 0.5, outcome: 1 }];
const metrics: [string, (opts: unknown) => unknown][] = [
  ['calibrationCurve', (opts) => calibrationCurve(samples, opts as BinningOptions)],
  ['expectedCalibrationError', (opts) => expectedCalibrationError(samples, opts as BinningOptions)],
  ['brierDecomposition', (opts) => brierDecomposition(samples, opts as BinningOptions)],
  ['logLoss', (opts) => logLoss(samples, opts as LogLossOptions)],
  ['computeReport', (opts) => computeReport(samples, opts as BinningOptions & LogLossOptions)],
];

describe.each(metrics)('%s options at the JavaScript boundary', (_name, metric) => {
  it.each([[null], [1], [true], ['invalid'], [[]], [() => undefined]])(
    'rejects a non-options value (%s) with a domain error',
    (opts) => {
      expect(() => metric(opts)).toThrow(CalibrationError);
    },
  );

  it('preserves defaults for omitted or undefined options', () => {
    expect(metric(undefined)).toEqual(metric({}));
    expect(metric({ bins: undefined, eps: undefined })).toEqual(metric({}));
  });
});

describe('explicit null option values', () => {
  it.each(metrics.filter(([name]) => name !== 'logLoss'))(
    '%s rejects null bins instead of silently using a default',
    (_name, metric) => {
      expect(() => metric({ bins: null })).toThrow(CalibrationError);
    },
  );

  it.each(metrics.filter(([name]) => name === 'logLoss' || name === 'computeReport'))(
    '%s rejects null eps instead of silently using a default',
    (_name, metric) => {
      expect(() => metric({ eps: null })).toThrow(CalibrationError);
    },
  );
});
