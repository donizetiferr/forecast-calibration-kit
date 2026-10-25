import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const compiler = resolve('node_modules/typescript/bin/tsc');
let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'forecast-package-'));
  const packageRoot = join(directory, 'node_modules', 'forecast-calibration-kit');
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    join(packageRoot, 'package.json'),
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  await build({
    config: false,
    entry: { index: 'src/index.ts' },
    outDir: join(packageRoot, 'dist'),
    format: ['esm', 'cjs'],
    target: 'node18',
    dts: true,
    silent: true,
  });
}, 30_000);

afterAll(async () => {
  if (directory !== undefined) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function typecheck(fixture: string): Promise<void> {
  await execute(process.execPath, [
    compiler,
    '--noEmit',
    '--strict',
    '--target',
    'ES2022',
    '--module',
    'Node16',
    '--moduleResolution',
    'Node16',
    fixture,
  ]).catch((error: { stdout: string; stderr: string }) => {
    throw new Error(`${error.stdout}${error.stderr}`, { cause: error });
  });
}

describe('package consumers', () => {
  it('compiles the documented TypeScript quick start in strict mode', async () => {
    const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
    const quickStart = readme.match(/```ts\r?\n([\s\S]*?)```/)?.[1];
    expect(quickStart).toBeDefined();
    const fixture = join(directory, 'quick-start.mts');
    await writeFile(fixture, quickStart!);
    await typecheck(fixture);
  }, 15_000);

  it.each(['cts', 'mts'])(
    'provides compatible types for a .%s consumer',
    async (extension) => {
      const fixture = join(directory, `consumer.${extension}`);
      await writeFile(
        fixture,
        [
          "import { brierScore, type Sample } from 'forecast-calibration-kit';",
          'const samples: readonly Sample[] = [{ p: 0.5, outcome: 1 }];',
          'const score: number = brierScore(samples);',
          'void score;',
        ].join('\n'),
      );
      await typecheck(fixture);
    },
    15_000,
  );

  it.each(['module', 'commonjs'])('loads the %s runtime entry', async (format) => {
    const declaration =
      format === 'module'
        ? "import { brierScore } from 'forecast-calibration-kit';"
        : "const { brierScore } = require('forecast-calibration-kit');";
    const { stdout, stderr } = await execute(
      process.execPath,
      [
        `--input-type=${format}`,
        '--eval',
        `${declaration}\nconsole.log(brierScore([{ p: 0.5, outcome: 1 }]));`,
      ],
      { cwd: directory },
    );
    expect(stderr).toBe('');
    expect(stdout).toBe('0.25\n');
  });
});
