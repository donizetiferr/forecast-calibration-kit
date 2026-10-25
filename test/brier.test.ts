import { describe, expect, it } from 'vitest';
import { brierScore, CalibrationError, type Sample } from '../src/index';

describe('brierScore', () => {
  it('keeps a small error that changes the rounded mean of mixed forecasts', () => {
    const samples: Sample[] = [
      { p: 1, outcome: 0 },
      { p: 2 ** -27, outcome: 0 },
      { p: 0, outcome: 0 },
    ];
    // (1 + 2^-54) / 3 rounds upward; rounding the sum first loses 2^-54.
    expect(brierScore(samples)).toBe(0.33333333333333337);
    expect(brierScore([...samples].reverse())).toBe(0.33333333333333337);
  });

  it.each([
    { p: 0.1, outcome: 0, count: 7 },
    { p: 0.1, outcome: 1, count: 5 },
    { p: 0.3, outcome: 0, count: 3 },
    { p: 1 - Number.EPSILON / 2, outcome: 0, count: 3 },
  ] as const)('preserves a repeated squared error exactly ($p, $outcome, $count)', (sample) => {
    const { p, outcome, count } = sample;
    const samples = Array.from({ length: count }, () => ({ p, outcome }));
    expect(brierScore(samples)).toBe((p - outcome) ** 2);
  });

  it('preserves the score when a constant forecast is repeated many times', () => {
    const sample: Sample = { p: 0.7, outcome: 0 };
    expect(brierScore(Array.from({ length: 10_000 }, () => sample))).toBeCloseTo(
      brierScore([sample]),
      15,
    );
  });

  it('retains small squared errors regardless of where a large error occurs', () => {
    const small: Sample[] = Array.from({ length: 10_000 }, () => ({ p: 1e-8, outcome: 0 }));
    const large: Sample = { p: 1, outcome: 0 };
    const expected = (1 + small.length * 1e-16) / (small.length + 1);
    for (const samples of [
      [large, ...small],
      [...small, large],
    ]) {
      expect(Math.abs(brierScore(samples) - expected)).toBeLessThan(expected * 1e-15);
    }
  });

  it('is 0 for perfect deterministic forecasts', () => {
    const samples: Sample[] = [
      { p: 1, outcome: 1 },
      { p: 0, outcome: 0 },
      { p: 1, outcome: 1 },
    ];
    expect(brierScore(samples)).toBe(0);
  });

  it('is 0.25 for a constant 0.5 forecaster regardless of outcomes', () => {
    const samples: Sample[] = [
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 0 },
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 0 },
    ];
    expect(brierScore(samples)).toBeCloseTo(0.25, 12);
  });

  it('is 1 for a maximally confident wrong forecast', () => {
    expect(brierScore([{ p: 1, outcome: 0 }])).toBe(1);
  });

  it('matches a hand-computed value', () => {
    // ((0.9 - 1)^2 + (0.2 - 0)^2) / 2 = (0.01 + 0.04) / 2 = 0.025
    const samples: Sample[] = [
      { p: 0.9, outcome: 1 },
      { p: 0.2, outcome: 0 },
    ];
    expect(brierScore(samples)).toBeCloseTo(0.025, 12);
  });

  it('throws a CalibrationError on empty input', () => {
    expect(() => brierScore([])).toThrow(CalibrationError);
  });
});
