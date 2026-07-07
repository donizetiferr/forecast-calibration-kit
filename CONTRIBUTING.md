# Contributing

Thanks for your interest in improving `forecast-calibration-kit`. Bug reports,
feature requests and pull requests are all welcome.

## Getting started

Prerequisites: Node.js 18 or newer.

```bash
git clone https://github.com/donizetiferr/forecast-calibration-kit.git
cd forecast-calibration-kit
npm install
```

## Common tasks

| Command                 | What it does                                   |
| ----------------------- | ---------------------------------------------- |
| `npm test`              | Run the test suite once                        |
| `npm run test:watch`    | Run tests in watch mode                        |
| `npm run test:coverage` | Run tests with a coverage report               |
| `npm run typecheck`     | Type-check with `tsc --noEmit`                 |
| `npm run lint`          | Lint with ESLint                               |
| `npm run format`        | Format with Prettier                           |
| `npm run build`         | Produce the `dist/` bundle (ESM + CJS + types) |

Before opening a pull request, please make sure the following all pass locally —
they are exactly what CI runs:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Guidelines

- **Strict TypeScript.** The public API is fully typed; `any` is disallowed by
  the lint config. Prefer `unknown` plus validation at boundaries.
- **Tests are required.** Every behaviour change needs a test. For new metrics,
  add a case with a known, hand-computable expected value and, where relevant, a
  test of the underlying mathematical identity. Keep coverage of the core high.
- **Validate inputs.** Public functions must reject malformed input with a clear
  `CalibrationError`.
- **Cite the maths.** When adding or changing a metric, reference the definition
  (paper, textbook, or a widely used implementation) in the PR description so
  reviewers can verify correctness.
- **Formatting.** Run `npm run format`; CI checks are not opinionated about style
  beyond what Prettier and ESLint enforce.

## Reporting bugs

Open an issue with a minimal reproduction: the input samples, the call you made,
the result you got, and the result you expected.
