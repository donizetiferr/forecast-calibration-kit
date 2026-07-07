import type { BrierDecomposition, CalibrationBin, Sample } from './types';
import { assertSamples } from './validation';
import { brierScore } from './metrics/brier';
import { logLoss } from './metrics/logLoss';
import { calibrationCurve, expectedCalibrationError } from './metrics/calibration';
import { brierDecomposition } from './metrics/decomposition';

/** Error raised while parsing command-line arguments (usage error). */
export class CliArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgError';
  }
}

/** Parsed command-line options. */
export interface CliOptions {
  input?: string;
  bins: number;
  format: 'table' | 'json';
  eps?: number;
  help: boolean;
  version: boolean;
}

/** Aggregated metrics for a dataset, as produced by the CLI. */
export interface CliReport {
  count: number;
  baseRate: number;
  brierScore: number;
  logLoss: number;
  expectedCalibrationError: number;
  decomposition: BrierDecomposition;
  calibrationCurve: CalibrationBin[];
}

/** Injected I/O so that {@link run} stays pure and testable. */
export interface CliIo {
  readStdin: () => Promise<string>;
  readFile: (path: string) => string;
  version: string;
}

/** Result of a CLI invocation. */
export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const DEFAULT_BINS = 10;
const USAGE =
  'Usage: forecast-calibration-kit [FILE] [--bins <n>] [--format table|json] [--eps <e>]';

/**
 * Parses CLI arguments (everything after the node executable and script name).
 *
 * @throws {CliArgError} on unknown flags, missing values, or invalid formats.
 */
export function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = { bins: DEFAULT_BINS, format: 'table', help: false, version: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '-v' || arg === '--version') {
      opts.version = true;
    } else if (arg === '--bins') {
      opts.bins = parseBins(argv[++i], '--bins');
    } else if (arg.startsWith('--bins=')) {
      opts.bins = parseBins(arg.slice('--bins='.length), '--bins');
    } else if (arg === '--eps') {
      opts.eps = parseEps(argv[++i], '--eps');
    } else if (arg.startsWith('--eps=')) {
      opts.eps = parseEps(arg.slice('--eps='.length), '--eps');
    } else if (arg === '--format') {
      opts.format = parseFormat(argv[++i], '--format');
    } else if (arg.startsWith('--format=')) {
      opts.format = parseFormat(arg.slice('--format='.length), '--format');
    } else if (arg.startsWith('-')) {
      throw new CliArgError(`Unknown option: ${arg}`);
    } else if (opts.input !== undefined) {
      throw new CliArgError(`Unexpected extra argument: ${arg}`);
    } else {
      opts.input = arg;
    }
  }

  return opts;
}

/**
 * Computes every metric for a dataset in one pass-friendly bundle.
 *
 * @throws {CalibrationError} if `samples` is empty or contains invalid entries.
 */
export function computeReport(
  samples: readonly Sample[],
  opts: { bins?: number; eps?: number } = {},
): CliReport {
  assertSamples(samples);
  const { bins, eps } = opts;
  let positives = 0;
  for (const { outcome } of samples) {
    positives += outcome;
  }
  return {
    count: samples.length,
    baseRate: positives / samples.length,
    brierScore: brierScore(samples),
    logLoss: logLoss(samples, { eps }),
    expectedCalibrationError: expectedCalibrationError(samples, { bins }),
    decomposition: brierDecomposition(samples, { bins }),
    calibrationCurve: calibrationCurve(samples, { bins }),
  };
}

/** Renders a report as either an aligned text table or pretty-printed JSON. */
export function formatReport(report: CliReport, format: 'table' | 'json'): string {
  return format === 'json' ? JSON.stringify(report, null, 2) : formatTable(report);
}

/**
 * Runs the CLI end to end using injected I/O. Never throws and never touches
 * `process` directly, so it can be exercised deterministically in tests.
 */
export async function run(argv: readonly string[], io: CliIo): Promise<CliResult> {
  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    return { stdout: '', stderr: `${message(error)}\n${USAGE}\n`, exitCode: 2 };
  }

  if (opts.help) {
    return { stdout: helpText(io.version), stderr: '', exitCode: 0 };
  }
  if (opts.version) {
    return { stdout: `${io.version}\n`, stderr: '', exitCode: 0 };
  }

  let raw: string;
  try {
    raw = opts.input !== undefined ? io.readFile(opts.input) : await io.readStdin();
  } catch (error) {
    return { stdout: '', stderr: `Failed to read input: ${message(error)}\n`, exitCode: 1 };
  }

  if (raw.trim() === '') {
    return {
      stdout: '',
      stderr: `No input provided. Pass a JSON file path or pipe JSON via stdin.\n${USAGE}\n`,
      exitCode: 2,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { stdout: '', stderr: `Input is not valid JSON: ${message(error)}\n`, exitCode: 1 };
  }

  if (!Array.isArray(parsed)) {
    return {
      stdout: '',
      stderr: 'Input must be a JSON array of { p, outcome } objects.\n',
      exitCode: 1,
    };
  }

  let report: CliReport;
  try {
    report = computeReport(parsed as Sample[], { bins: opts.bins, eps: opts.eps });
  } catch (error) {
    return { stdout: '', stderr: `${message(error)}\n`, exitCode: 1 };
  }

  return { stdout: `${formatReport(report, opts.format)}\n`, stderr: '', exitCode: 0 };
}

function parseBins(value: string | undefined, flag: string): number {
  const n = parseNumber(value, flag);
  if (!Number.isInteger(n) || n < 1) {
    throw new CliArgError(`${flag} expects a positive integer, received "${value}".`);
  }
  return n;
}

function parseEps(value: string | undefined, flag: string): number {
  const n = parseNumber(value, flag);
  if (n <= 0 || n >= 0.5) {
    throw new CliArgError(`${flag} expects a number in (0, 0.5), received "${value}".`);
  }
  return n;
}

function parseNumber(value: string | undefined, flag: string): number {
  if (value === undefined) {
    throw new CliArgError(`Missing value for ${flag}.`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new CliArgError(`${flag} expects a number, received "${value}".`);
  }
  return n;
}

function parseFormat(value: string | undefined, flag: string): 'table' | 'json' {
  if (value === 'table' || value === 'json') {
    return value;
  }
  throw new CliArgError(`${flag} expects "table" or "json", received "${value}".`);
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : String(n);
}

function formatTable(r: CliReport): string {
  const label = 30;
  const lines: string[] = [
    'Forecast calibration report',
    '===========================',
    `Samples:    ${r.count}`,
    `Base rate:  ${fmt(r.baseRate)}`,
    '',
    `${'Metric'.padEnd(label)}Value`,
    `${'-'.repeat(label)}--------`,
    `${'Brier score'.padEnd(label)}${fmt(r.brierScore)}`,
    `${'Log loss'.padEnd(label)}${fmt(r.logLoss)}`,
    `${'Expected calibration error'.padEnd(label)}${fmt(r.expectedCalibrationError)}`,
    '',
    'Brier decomposition (Brier = reliability - resolution + uncertainty)',
    `${'  reliability'.padEnd(label)}${fmt(r.decomposition.reliability)}`,
    `${'  resolution'.padEnd(label)}${fmt(r.decomposition.resolution)}`,
    `${'  uncertainty'.padEnd(label)}${fmt(r.decomposition.uncertainty)}`,
    '',
    `Calibration curve (${r.calibrationCurve.length} non-empty bin(s))`,
    `  ${'bin mid'.padEnd(10)}${'mean pred'.padEnd(12)}${'obs freq'.padEnd(12)}count`,
    `  ${'-'.repeat(10)}${'-'.repeat(12)}${'-'.repeat(12)}-----`,
  ];
  for (const b of r.calibrationCurve) {
    lines.push(
      `  ${fmt(b.binMidpoint).padEnd(10)}${fmt(b.meanPredicted).padEnd(12)}` +
        `${fmt(b.observedFrequency).padEnd(12)}${b.count}`,
    );
  }
  return lines.join('\n');
}

function helpText(version: string): string {
  return [
    `forecast-calibration-kit v${version}`,
    '',
    'Calibration metrics for probabilistic (binary) forecasts.',
    '',
    'USAGE:',
    '  forecast-calibration-kit [FILE] [options]',
    '  cat data.json | forecast-calibration-kit [options]',
    '',
    'INPUT:',
    '  A JSON array of { "p": <0..1>, "outcome": <0|1> } objects, read from FILE or stdin.',
    '',
    'OPTIONS:',
    '  --bins <n>       Number of probability bins for calibration (default: 10).',
    '  --format <fmt>   Output format: "table" (default) or "json".',
    '  --eps <e>        Probability clamp for log loss, in (0, 0.5) (default: 1e-15).',
    '  -h, --help       Show this help.',
    '  -v, --version    Show version.',
    '',
  ].join('\n');
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
