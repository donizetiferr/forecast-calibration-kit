import { describe, expect, it } from 'vitest';
import { brierScore, CalibrationError, type Sample } from '../src/index';

describe('brierScore', () => {
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
