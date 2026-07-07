import { describe, expect, it } from 'vitest';
import {
  calibrationCurve,
  CalibrationError,
  expectedCalibrationError,
  type Sample,
} from '../src/index';

const TWO_BIN_SET: Sample[] = [
  { p: 0.2, outcome: 0 },
  { p: 0.3, outcome: 1 },
  { p: 0.8, outcome: 1 },
  { p: 0.9, outcome: 1 },
];

describe('calibrationCurve', () => {
  it('groups samples into bins with correct aggregates', () => {
    const curve = calibrationCurve(TWO_BIN_SET, { bins: 2 });
    expect(curve).toHaveLength(2);

    const [low, high] = curve;
    expect(low?.binMidpoint).toBeCloseTo(0.25, 12);
    expect(low?.meanPredicted).toBeCloseTo(0.25, 12);
    expect(low?.observedFrequency).toBeCloseTo(0.5, 12);
    expect(low?.count).toBe(2);

    expect(high?.binMidpoint).toBeCloseTo(0.75, 12);
    expect(high?.meanPredicted).toBeCloseTo(0.85, 12);
    expect(high?.observedFrequency).toBeCloseTo(1, 12);
    expect(high?.count).toBe(2);
  });

  it('places p = 1 in the last bin', () => {
    const curve = calibrationCurve([{ p: 1, outcome: 1 }], { bins: 10 });
    expect(curve).toHaveLength(1);
    expect(curve[0]?.binMidpoint).toBeCloseTo(0.95, 12);
    expect(curve[0]?.count).toBe(1);
  });

  it('omits empty bins from the result', () => {
    const curve = calibrationCurve(
      [
        { p: 0.01, outcome: 0 },
        { p: 0.02, outcome: 1 },
      ],
      { bins: 10 },
    );
    expect(curve).toHaveLength(1);
    expect(curve[0]?.count).toBe(2);
  });

  it('throws on an invalid bins option', () => {
    expect(() => calibrationCurve(TWO_BIN_SET, { bins: 0 })).toThrow(CalibrationError);
    expect(() => calibrationCurve(TWO_BIN_SET, { bins: -3 })).toThrow(CalibrationError);
    expect(() => calibrationCurve(TWO_BIN_SET, { bins: 2.5 })).toThrow(CalibrationError);
  });

  it('throws a CalibrationError on empty input', () => {
    expect(() => calibrationCurve([])).toThrow(CalibrationError);
  });
});

describe('expectedCalibrationError', () => {
  it('matches a hand-computed value', () => {
    // bin0: |0.25 - 0.5| * (2/4) = 0.125 ; bin1: |0.85 - 1| * (2/4) = 0.075 ; total = 0.2
    expect(expectedCalibrationError(TWO_BIN_SET, { bins: 2 })).toBeCloseTo(0.2, 12);
  });

  it('is 0 for a perfectly calibrated forecaster', () => {
    const samples: Sample[] = [
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 0 },
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 0 },
      { p: 1, outcome: 1 },
      { p: 1, outcome: 1 },
    ];
    expect(expectedCalibrationError(samples, { bins: 10 })).toBeCloseTo(0, 12);
  });

  it('lies in [0, 1]', () => {
    const value = expectedCalibrationError(TWO_BIN_SET);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  it('throws on an invalid bins option', () => {
    expect(() => expectedCalibrationError(TWO_BIN_SET, { bins: 0 })).toThrow(CalibrationError);
  });

  it('throws a CalibrationError on empty input', () => {
    expect(() => expectedCalibrationError([])).toThrow(CalibrationError);
  });
});
