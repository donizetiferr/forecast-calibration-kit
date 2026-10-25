import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let directory: string;
let binary: string;
let version: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'forecast-cli-'));
  const pkg = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  version = (JSON.parse(pkg) as { version: string }).version;
  await writeFile(join(directory, 'package.json'), pkg);
  await mkdir(join(directory, 'dist'));
  await build({
    config: false,
    entry: { cli: 'src/bin.ts' },
    outDir: join(directory, 'dist'),
    format: ['esm'],
    target: 'node18',
    silent: true,
  });
  binary = join(directory, 'dist', 'cli.js');
}, 30_000);

afterAll(async () => {
  if (directory !== undefined) {
    await rm(directory, { recursive: true, force: true });
  }
});

function invoke(args: string[], input = ''): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [binary, ...args],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 10_000 },
      (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve({ stdout, stderr });
      },
    );
    child.stdin!.end(input);
  });
}

describe('CLI executable', () => {
  it('prints the package version', async () => {
    expect(await invoke(['--version'])).toEqual({ stdout: `${version}\n`, stderr: '' });
  });

  it('flushes a large JSON report completely before exiting', async () => {
    const count = 12_000;
    const samples = Array.from({ length: count }, (_, i) => ({
      p: (i + 0.5) / count,
      outcome: i % 2,
    }));
    const { stdout, stderr } = await invoke(
      ['--bins', String(count), '--format', 'json'],
      JSON.stringify(samples),
    );
    expect(stderr).toBe('');
    const report = JSON.parse(stdout) as { count: number; calibrationCurve: unknown[] };
    expect(report.count).toBe(count);
    expect(report.calibrationCurve).toHaveLength(count);
    expect(stdout.endsWith('\n')).toBe(true);
  });
});
