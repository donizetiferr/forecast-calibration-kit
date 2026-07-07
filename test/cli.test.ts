import { describe, expect, it } from 'vitest';
import { type CliIo, CliArgError, computeReport, formatReport, parseArgs, run } from '../src/cli';
import type { Sample } from '../src/types';

const SAMPLES: Sample[] = [
  { p: 0.2, outcome: 0 },
  { p: 0.3, outcome: 1 },
  { p: 0.8, outcome: 1 },
  { p: 0.9, outcome: 1 },
];
const SAMPLES_JSON = JSON.stringify(SAMPLES);

function fakeIo(overrides: Partial<CliIo> = {}): CliIo {
  return {
    readStdin: async () => '',
    readFile: () => {
      throw new Error('unexpected readFile');
    },
    version: '9.9.9',
    ...overrides,
  };
}

describe('parseArgs', () => {
  it('applies sensible defaults', () => {
    expect(parseArgs([])).toEqual({
      bins: 10,
      format: 'table',
      help: false,
      version: false,
    });
  });

  it('parses --bins in both spaced and = forms', () => {
    expect(parseArgs(['--bins', '5']).bins).toBe(5);
    expect(parseArgs(['--bins=7']).bins).toBe(7);
  });

  it('parses --format, --eps (both spaced and = forms) and a positional file argument', () => {
    expect(parseArgs(['--format', 'json']).format).toBe('json');
    expect(parseArgs(['--format=json']).format).toBe('json');
    expect(parseArgs(['--eps', '0.01']).eps).toBe(0.01);
    expect(parseArgs(['--eps=0.02']).eps).toBe(0.02);
    expect(parseArgs(['data.json']).input).toBe('data.json');
  });

  it('recognises help and version flags', () => {
    expect(parseArgs(['-h']).help).toBe(true);
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
    expect(parseArgs(['--version']).version).toBe(true);
  });

  it('rejects invalid or malformed arguments', () => {
    expect(() => parseArgs(['--nope'])).toThrow(CliArgError);
    expect(() => parseArgs(['--format', 'xml'])).toThrow(CliArgError);
    expect(() => parseArgs(['--bins', '0'])).toThrow(CliArgError);
    expect(() => parseArgs(['--bins', '2.5'])).toThrow(CliArgError);
    expect(() => parseArgs(['--eps', '0.9'])).toThrow(CliArgError);
    expect(() => parseArgs(['--bins'])).toThrow(CliArgError);
    expect(() => parseArgs(['a.json', 'b.json'])).toThrow(CliArgError);
  });

  it('rejects a non-numeric value for --bins or --eps', () => {
    expect(() => parseArgs(['--bins', 'abc'])).toThrow(/expects a number/);
    expect(() => parseArgs(['--eps', 'abc'])).toThrow(/expects a number/);
  });
});

describe('computeReport', () => {
  it('computes count, base rate and every metric', () => {
    const report = computeReport(SAMPLES, { bins: 2 });
    expect(report.count).toBe(4);
    expect(report.baseRate).toBeCloseTo(0.75, 12);
    expect(report.brierScore).toBeGreaterThan(0);
    expect(report.calibrationCurve.length).toBeGreaterThan(0);
    expect(report.decomposition).toHaveProperty('reliability');
    expect(report.decomposition).toHaveProperty('resolution');
    expect(report.decomposition).toHaveProperty('uncertainty');
  });

  it('computes a fractional base rate correctly', () => {
    const report = computeReport([
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 1 },
      { p: 0.5, outcome: 0 },
    ]);
    expect(report.baseRate).toBeCloseTo(2 / 3, 12);
  });
});

describe('formatReport', () => {
  it('produces valid JSON in json mode', () => {
    const report = computeReport(SAMPLES);
    const parsed = JSON.parse(formatReport(report, 'json'));
    expect(parsed.brierScore).toBeCloseTo(report.brierScore, 12);
    expect(Array.isArray(parsed.calibrationCurve)).toBe(true);
  });

  it('produces a readable table in table mode', () => {
    const table = formatReport(computeReport(SAMPLES), 'table');
    expect(table).toContain('Forecast calibration report');
    expect(table).toContain('Base rate:');
    expect(table).toContain('Brier score');
    expect(table).toContain('Calibration curve');
  });
});

describe('run', () => {
  it('prints the version and exits 0', async () => {
    const result = await run(['--version'], fakeIo());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('9.9.9\n');
  });

  it('prints help and exits 0', async () => {
    const result = await run(['--help'], fakeIo());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('USAGE:');
  });

  it('reads JSON from stdin and prints a table', async () => {
    const result = await run([], fakeIo({ readStdin: async () => SAMPLES_JSON }));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Brier score');
  });

  it('emits JSON output when --format json is set', async () => {
    const result = await run(['--format', 'json'], fakeIo({ readStdin: async () => SAMPLES_JSON }));
    expect(result.exitCode).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  it('reads from a file argument', async () => {
    const result = await run(['data.json'], fakeIo({ readFile: () => SAMPLES_JSON }));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Brier score');
  });

  it('fails with exit 1 on invalid JSON', async () => {
    const result = await run([], fakeIo({ readStdin: async () => 'not json' }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not valid JSON');
  });

  it('fails with exit 1 when input is not an array', async () => {
    const result = await run([], fakeIo({ readStdin: async () => '{"p":0.5}' }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('must be a JSON array');
  });

  it('fails with exit 2 on empty input', async () => {
    const result = await run([], fakeIo({ readStdin: async () => '   ' }));
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('No input');
  });

  it('fails with exit 1 on a domain-invalid sample', async () => {
    const result = await run([], fakeIo({ readStdin: async () => '[{"p":2,"outcome":1}]' }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('p must be a number in [0, 1]');
  });

  it('fails with exit 2 on an unknown option', async () => {
    const result = await run(['--nope'], fakeIo());
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Unknown option');
  });

  it('fails with exit 1 when the file cannot be read', async () => {
    const result = await run(
      ['missing.json'],
      fakeIo({
        readFile: () => {
          throw new Error('ENOENT: no such file');
        },
      }),
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Failed to read input');
  });
});
