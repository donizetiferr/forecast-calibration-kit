import { describe, expect, it } from 'vitest';
import { CalibrationError, logLoss, type Sample } from '../src/index';

describe('logLoss', () => {
  it.each([
    { p: 0.1, outcome: 0, count: 3 },
    { p: 0.2, outcome: 0, count: 3 },
    { p: 0.8, outcome: 0, count: 5 },
    { p: 0.9, outcome: 1, count: 5 },
  ] as const)('preserves a repeated log penalty exactly ($p, $outcome, $count)', (sample) => {
    const { p, outcome, count } = sample;
    const samples = Array.from({ length: count }, () => ({ p, outcome }));
    const penalty = outcome === 1 ? -Math.log(p) : -Math.log1p(-p);
    expect(logLoss(samples)).toBe(penalty);
  });

  it('preserves the score when a constant forecast is repeated many times', () => {
    const sample: Sample = { p: 0.7, outcome: 1 };
    expect(logLoss(Array.from({ length: 10_000 }, () => sample))).toBeCloseTo(
      logLoss([sample]),
      15,
    );
  });

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

  it.each([Number.MIN_VALUE, 1e-20, 1e-15, 0.1])(
    'keeps endpoint penalties finite and symmetric with eps = %s',
    (eps) => {
      const positiveMiss = logLoss([{ p: 0, outcome: 1 }], { eps });
      const negativeMiss = logLoss([{ p: 1, outcome: 0 }], { eps });
      expect(positiveMiss).toBe(-Math.log(eps));
      expect(negativeMiss).toBe(positiveMiss);

      const positiveHit = logLoss([{ p: 1, outcome: 1 }], { eps });
      const negativeHit = logLoss([{ p: 0, outcome: 0 }], { eps });
      expect(positiveHit).toBe(-Math.log1p(-eps));
      expect(negativeHit).toBe(positiveHit);
    },
  );

  it('preserves probabilities smaller than machine epsilon without cancellation', () => {
    const p = 1e-20;
    const eps = Number.MIN_VALUE;
    expect(logLoss([{ p, outcome: 0 }], { eps })).toBe(-Math.log1p(-p));
    expect(logLoss([{ p, outcome: 1 }], { eps })).toBe(-Math.log(p));
  });
});
