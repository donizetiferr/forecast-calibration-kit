import { describe, expect, it } from 'vitest';
import { CalibrationError, logLoss, type Sample } from '../src/index';

describe('logLoss', () => {
  it('equals ln(2) for a constant 0.5 forecaster', () => {
    const samples: Sample[] = [
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 0 },
    ];
    expect(logLoss(samples)).toBeCloseTo(Math.LN2, 12);
  });

  it('is near 0 (but finite) for perfect forecasts, thanks to eps clamping', () => {
    const samples: Sample[] = [
      { p: 1, outcome: 1 },
      { p: 0, outcome: 0 },
    ];
    const value = logLoss(samples);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1e-10);
  });

  it('matches a hand-computed single-sample value', () => {
    // -ln(0.8) = 0.2231435513...
    expect(logLoss([{ p: 0.8, outcome: 1 }])).toBeCloseTo(0.22314355131420976, 12);
  });

  it('applies a custom eps clamp to a confident-but-wrong forecast', () => {
    // p=0, outcome=1, eps=0.1 -> clamp to 0.1 -> -ln(0.1) = 2.302585...
    expect(logLoss([{ p: 0, outcome: 1 }], { eps: 0.1 })).toBeCloseTo(2.302585092994046, 12);
  });

  it('penalises confident wrong forecasts heavily but finitely', () => {
    const value = logLoss([{ p: 1, outcome: 0 }]);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(30);
  });

  it('throws when eps is out of the (0, 0.5) range', () => {
    const samples: Sample[] = [{ p: 0.5, outcome: 1 }];
    expect(() => logLoss(samples, { eps: 0 })).toThrow(CalibrationError);
    expect(() => logLoss(samples, { eps: 0.5 })).toThrow(CalibrationError);
    expect(() => logLoss(samples, { eps: 0.9 })).toThrow(CalibrationError);
  });

  it('throws a CalibrationError on empty input', () => {
    expect(() => logLoss([])).toThrow(CalibrationError);
  });
});
