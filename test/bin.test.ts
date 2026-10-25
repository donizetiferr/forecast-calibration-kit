import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
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

function invoke(
  args: string[],
  input: string | Buffer = '',
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [binary, ...args],
      { cwd: directory, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 10_000 },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
    child.stdin!.end(input);
  });
}

describe('CLI executable', () => {
  describe.each(['file', 'stdin'] as const)('%s UTF-8 input', (source) => {
    it.each([
      ['an isolated continuation byte', [0x80]],
      ['an incomplete sequence', [0xc3]],
      ['an overlong sequence', [0xc0, 0xaf]],
      ['an encoded surrogate', [0xed, 0xa0, 0x80]],
    ] as const)('rejects %s instead of replacing corrupted bytes', async (_name, bytes) => {
      const raw = Buffer.concat([
        Buffer.from('[{"p":0.5,"outcome":1,"note":"'),
        Buffer.from(bytes),
        Buffer.from('"}]'),
      ]);
      const path = join(directory, 'invalid-utf8.json');
      await writeFile(path, raw);
      await expect(
        invoke(source === 'file' ? [path, '--format=json'] : ['--format=json'], raw),
      ).rejects.toMatchObject({
        code: 1,
        stdout: '',
        stderr: expect.stringMatching(/^Failed to read input: .*utf-8.*\n$/i),
      });
    });

    it('accepts valid multibyte text and a literal replacement character', async () => {
      const raw = '\uFEFF[{"p":0.5,"outcome":1,"note":"São Paulo 🌦 �"}]';
      const path = join(directory, 'valid-utf8.json');
      await writeFile(path, raw, 'utf8');
      const { stdout, stderr } = await invoke(
        source === 'file' ? [path, '--format=json'] : ['--format=json'],
        raw,
      );
      expect(stderr).toBe('');
      expect(JSON.parse(stdout)).toMatchObject({ count: 1, brierScore: 0.25 });
    });
  });

  it('scores a relative file name starting with a dash after --', async () => {
    await writeFile(join(directory, '-data.json'), '[{"p":0.5,"outcome":1}]');
    const { stdout, stderr } = await invoke(['--format=json', '--', '-data.json']);
    expect(stderr).toBe('');
    expect(JSON.parse(stdout)).toMatchObject({ count: 1, brierScore: 0.25 });
  });

  it.skipIf(process.platform !== 'linux')(
    'reports a failed output write without a stack trace',
    async () => {
      const full = await open('/dev/full', 'w');
      try {
        const result = await new Promise<{ code: number | null; stderr: string }>(
          (resolve, reject) => {
            const child = spawn(process.execPath, [binary, '--version'], {
              stdio: ['ignore', full.fd, 'pipe'],
              timeout: 10_000,
            });
            let stderr = '';
            child.stderr!.on('data', (chunk: Buffer) => {
              stderr += chunk.toString('utf8');
            });
            child.on('error', reject);
            child.on('close', (code) => resolve({ code, stderr }));
          },
        );
        expect(result.code).toBe(1);
        expect(result.stderr).toMatch(/^Failed to write output: .*ENOSPC.*\n$/);
      } finally {
        await full.close();
      }
    },
  );

  it.each(['stdout', 'stderr'] as const)(
    'handles a closed %s pipe without an unhandled error',
    async (stream) => {
      const other = stream === 'stdout' ? 'stderr' : 'stdout';
      const monitor = join(directory, `monitor-${stream}.cjs`);
      await writeFile(
        monitor,
        `process.on('uncaughtExceptionMonitor', () => process.${other}.write('Unhandled exception\\n'));`,
      );
      const result = await new Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
        output: string;
      }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--require', monitor, binary, stream === 'stdout' ? '--version' : '--unknown'],
          { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
        );
        let output = '';
        child[stream]!.destroy();
        child[other]!.on('data', (chunk: Buffer) => {
          output += chunk.toString('utf8');
        });
        child.on('error', reject);
        child.on('close', (code, signal) => resolve({ code, signal, output }));
      });
      expect(result).toEqual({ code: 1, signal: null, output: '' });
    },
  );

  it.each(['file', 'stdin'] as const)(
    'reads a UTF-8 BOM from %s with the real executable',
    async (source) => {
      const raw = '\uFEFF[{"p":0.5,"outcome":1}]\r\n';
      const path = join(directory, 'utf8-bom.json');
      await writeFile(path, raw, 'utf8');
      const { stdout, stderr } = await invoke(
        source === 'file' ? [path, '--format=json'] : ['--format=json'],
        source === 'stdin' ? raw : '',
      );
      expect(stderr).toBe('');
      const report = JSON.parse(stdout) as { count: number; brierScore: number };
      expect(report.count).toBe(1);
      expect(report.brierScore).toBe(0.25);
    },
  );

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
