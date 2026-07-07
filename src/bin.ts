import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './cli';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
  version: string;
};

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

run(process.argv.slice(2), {
  readStdin,
  readFile: (path) => readFileSync(path, 'utf8'),
  version: pkg.version,
})
  .then((result) => {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.exitCode);
  })
  .catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Unexpected error: ${detail}\n`);
    process.exit(1);
  });
