import { describe, expect, it } from 'vitest';
import { CalibrationError } from '../src/index';
import { assertBins, assertEps, assertSamples } from '../src/validation';
import type { Sample } from '../src/types';

describe('assertSamples', () => {
  it('accepts a valid non-empty list', () => {
    expect(() =>
      assertSamples([
        { p: 0, outcome: 0 },
        { p: 1, outcome: 1 },
        { p: 0.5, outcome: 0 },
      ]),
    ).not.toThrow();
  });

  it('rejects a non-array input', () => {
    expect(() => assertSamples('nope' as unknown as Sample[])).toThrow(CalibrationError);
  });

  it('rejects an empty list', () => {
    expect(() => assertSamples([])).toThrow(/must not be empty/);
  });

  it('rejects p below 0 or above 1', () => {
    expect(() => assertSamples([{ p: -0.01, outcome: 0 }])).toThrow(
      /p must be a number in \[0, 1\]/,
    );
    expect(() => assertSamples([{ p: 1.5, outcome: 1 }])).toThrow(/p must be a number in \[0, 1\]/);
  });

  it('rejects a NaN probability', () => {
    expect(() => assertSamples([{ p: Number.NaN, outcome: 0 }])).toThrow(CalibrationError);
  });

  it('rejects an outcome that is not 0 or 1', () => {
    expect(() => assertSamples([{ p: 0.5, outcome: 2 as unknown as 0 }])).toThrow(
      /outcome must be 0 or 1/,
    );
    expect(() => assertSamples([{ p: 0.5, outcome: 0.5 as unknown as 0 }])).toThrow(
      /outcome must be 0 or 1/,
    );
  });

  it('rejects a non-object element', () => {
    expect(() => assertSamples([null as unknown as Sample])).toThrow(CalibrationError);
  });

  it('rejects a missing probability', () => {
    expect(() => assertSamples([{ outcome: 1 } as unknown as Sample])).toThrow(
      /p must be a number/,
    );
  });

  it('reports a helpful message for non-number probabilities', () => {
    expect(() => assertSamples([{ p: 'x' as unknown as number, outcome: 0 }])).toThrow(
      /received "x"/,
    );
    expect(() => assertSamples([{ p: {} as unknown as number, outcome: 0 }])).toThrow(
      CalibrationError,
    );
  });
});

describe('assertBins', () => {
  it('accepts positive integers', () => {
    expect(() => assertBins(1)).not.toThrow();
    expect(() => assertBins(10)).not.toThrow();
  });

  it('rejects zero, negatives, non-integers and NaN', () => {
    expect(() => assertBins(0)).toThrow(CalibrationError);
    expect(() => assertBins(-1)).toThrow(CalibrationError);
    expect(() => assertBins(2.5)).toThrow(CalibrationError);
    expect(() => assertBins(Number.NaN)).toThrow(CalibrationError);
  });
});

describe('assertEps', () => {
  it('accepts values inside (0, 0.5)', () => {
    expect(() => assertEps(1e-15)).not.toThrow();
    expect(() => assertEps(0.1)).not.toThrow();
  });

  it('rejects boundary and out-of-range values', () => {
    expect(() => assertEps(0)).toThrow(CalibrationError);
    expect(() => assertEps(0.5)).toThrow(CalibrationError);
    expect(() => assertEps(0.9)).toThrow(CalibrationError);
    expect(() => assertEps(-0.1)).toThrow(CalibrationError);
    expect(() => assertEps(Number.NaN)).toThrow(CalibrationError);
  });
});

describe('CalibrationError', () => {
  it('has the expected name and is an Error', () => {
    const error = new CalibrationError('boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CalibrationError');
    expect(error.message).toBe('boom');
  });
});
