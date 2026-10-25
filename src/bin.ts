import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { run } from './cli';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
  version: string;
};
// Reject malformed bytes instead of silently replacing them. Keep the BOM for
// the shared JSON parser, which handles a single leading BOM for both sources.
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return utf8.decode(Buffer.concat(chunks));
}

// A downstream command may close its pipe before the report has been written.
// Stream errors are asynchronous and are not caught by the promise below.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  process.exitCode = 1;
  if (error.code !== 'EPIPE') {
    process.stderr.write(`Failed to write output: ${error.message}\n`);
  }
});
process.stderr.on('error', () => {
  process.exitCode = 1;
});

run(process.argv.slice(2), {
  readStdin,
  readFile: (path) => utf8.decode(readFileSync(path)),
  version: pkg.version,
})
  .then((result) => {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    // Let Node drain stdout/stderr pipes before terminating the process.
    process.exitCode = result.exitCode;
  })
  .catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Unexpected error: ${detail}\n`);
    process.exitCode = 1;
  });
