import { describe, expect, it } from 'vitest';
import {
  brierDecomposition,
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
  it('keeps a probability on a decimal boundary in the bin to its right', () => {
    const samples: Sample[] = [
      { p: 0.58, outcome: 0 },
      { p: 0.5800000000000001, outcome: 1 },
    ];
    const curve = calibrationCurve(samples, { bins: 100 });
    expect(curve).toHaveLength(1);
    expect(curve[0]?.binMidpoint).toBe(0.585);
    expect(curve[0]?.count).toBe(2);
    expect(expectedCalibrationError(samples, { bins: 100 })).toBeCloseTo(0.08, 15);
    expect(brierDecomposition(samples, { bins: 100 }).reliability).toBeCloseTo(0.0064, 15);
  });

  it('keeps a probability immediately below a boundary in the bin to its left', () => {
    const curve = calibrationCurve(
      [
        { p: 0.8999999999999999, outcome: 0 },
        { p: 0.9, outcome: 1 },
      ],
      { bins: 10 },
    );
    expect(curve.map(({ binMidpoint, count }) => ({ binMidpoint, count }))).toEqual([
      { binMidpoint: 0.85, count: 1 },
      { binMidpoint: 0.95, count: 1 },
    ]);
  });

  it('uses left-closed, right-open intervals at every boundary for 2 through 100 bins', () => {
    const bytes = new DataView(new ArrayBuffer(8));
    for (let bins = 2; bins <= 100; bins++) {
      for (let index = 1; index < bins; index++) {
        const boundary = index / bins;
        bytes.setFloat64(0, boundary);
        const bits = bytes.getBigUint64(0);
        bytes.setBigUint64(0, bits - 1n);
        const before = bytes.getFloat64(0);
        bytes.setBigUint64(0, bits + 1n);
        const after = bytes.getFloat64(0);
        const curve = calibrationCurve(
          [before, boundary, after].map((p) => ({ p, outcome: 0 })),
          { bins },
        );
        expect(
          curve.map(({ binMidpoint, count }) => ({ binMidpoint, count })),
          `boundary ${index}/${bins}`,
        ).toEqual([
          { binMidpoint: (index - 0.5) / bins, count: 1 },
          { binMidpoint: (index + 0.5) / bins, count: 2 },
        ]);
      }
    }
  });

  it('preserves the mean of repeated probabilities in a large calibrated bin', () => {
    const samples: Sample[] = Array.from({ length: 10_000 }, (_, i) => ({
      p: 0.7,
      outcome: i < 7_000 ? 1 : 0,
    }));
    expect(calibrationCurve(samples)[0]?.meanPredicted).toBe(0.7);
    expect(expectedCalibrationError(samples)).toBe(0);
    expect(brierDecomposition(samples).reliability).toBe(0);
  });

  it('handles billions of mostly empty bins without allocating empty entries', () => {
    const bins = 2 ** 32;
    const samples: Sample[] = [
      { p: 1, outcome: 1 },
      { p: 0.5, outcome: 0 },
      { p: 0, outcome: 0 },
      { p: 0.5, outcome: 1 },
    ];
    expect(calibrationCurve(samples, { bins })).toEqual([
      { binMidpoint: 0.5 / bins, meanPredicted: 0, observedFrequency: 0, count: 1 },
      {
        binMidpoint: 0.5 + 0.5 / bins,
        meanPredicted: 0.5,
        observedFrequency: 0.5,
        count: 2,
      },
      { binMidpoint: 1 - 0.5 / bins, meanPredicted: 1, observedFrequency: 1, count: 1 },
    ]);
    expect(expectedCalibrationError(samples, { bins })).toBe(0);
    expect(brierDecomposition(samples, { bins })).toEqual({
      reliability: 0,
      resolution: 0.125,
      uncertainty: 0.25,
    });
  });

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
  it('preserves the total gap across many occupied bins', () => {
    const bins = 2 ** 48;
    const samples: Sample[] = [{ p: 0, outcome: 1 }];
    let state = 42;
    let numeratorSum = 0;
    for (let i = 0; i < 10_000; i++) {
      state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
      const numerator = state + 1;
      numeratorSum += numerator;
      samples.push({ p: numerator / bins, outcome: 0 });
    }
    // Every bin contains one sample. Integer numerators sum exactly here.
    const expected = (1 + numeratorSum / bins) / samples.length;
    const actual = expectedCalibrationError(samples, { bins });
    expect(Math.abs(actual - expected)).toBeLessThan(expected * Number.EPSILON * 4);
  });

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
