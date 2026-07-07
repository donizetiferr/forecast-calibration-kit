# forecast-calibration-kit

[![CI](https://github.com/donizetiferr/forecast-calibration-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/donizetiferr/forecast-calibration-kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/forecast-calibration-kit)](https://www.npmjs.com/package/forecast-calibration-kit)
[![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen.svg)](#contributing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Calibration metrics for probabilistic (binary) forecasts, in TypeScript.
Score how good your probabilities are and, crucially, whether they mean what they
say: **Brier score**, **log loss**, **calibration curve** (reliability diagram),
**Expected Calibration Error (ECE)**, and the **Murphy decomposition** of the
Brier score into reliability, resolution and uncertainty.

- Zero runtime dependencies.
- Strict TypeScript, fully typed public API, ships ESM **and** CommonJS builds.
- Input validation at the boundary with clear, actionable errors.
- A small CLI for scoring a JSON dataset straight from the terminal.

## Why this exists

Probabilistic forecasting is everywhere — weather, prediction markets, credit
risk, sports, and the probability outputs of machine-learning classifiers.
This library provides a small, dependency-free TypeScript toolkit for scoring
how good those probabilities are: Brier score, log loss, calibration curve
(reliability diagram), Expected Calibration Error, and the Murphy (1973)
decomposition of the Brier score into reliability, resolution and uncertainty —
plus a CLI for scoring a dataset without writing any code.

## Installation

```bash
npm install forecast-calibration-kit
```

Requires Node.js 18 or newer. Works in both ESM and CommonJS projects.

## Quick start

```ts
import {
  brierScore,
  logLoss,
  calibrationCurve,
  expectedCalibrationError,
  brierDecomposition,
} from 'forecast-calibration-kit';

// Each sample pairs a forecast probability `p` in [0, 1] with a binary outcome (0 or 1).
const samples = [
  { p: 0.9, outcome: 1 },
  { p: 0.8, outcome: 1 },
  { p: 0.3, outcome: 0 },
  { p: 0.6, outcome: 1 },
  { p: 0.2, outcome: 0 },
];

brierScore(samples); // 0.068 — mean squared error, lower is better
logLoss(samples); // 0.2838 — log score / cross-entropy, lower is better
expectedCalibrationError(samples, { bins: 5 }); // 0.24 — gap between confidence and reality

calibrationCurve(samples, { bins: 5 });
// [{ binMidpoint, meanPredicted, observedFrequency, count }, ...]

brierDecomposition(samples, { bins: 5 });
// { reliability, resolution, uncertainty }
```

CommonJS works too:

```js
const { brierScore } = require('forecast-calibration-kit');
```

## API

All functions take a non-empty array of `Sample` objects
(`{ p: number /* [0,1] */, outcome: 0 | 1 }`) and throw a `CalibrationError`
if the input is empty or malformed (`p` out of range, `outcome` not `0`/`1`,
invalid options).

### `brierScore(samples): number`

Mean squared error between forecast probabilities and outcomes:
`BS = (1/N) · Σ (pᵢ − outcomeᵢ)²`. Range `[0, 1]`; **lower is better**.

### `logLoss(samples, opts?): number`

Logarithmic loss (binary cross-entropy):
`LL = −(1/N) · Σ [outcomeᵢ·ln(pᵢ) + (1 − outcomeᵢ)·ln(1 − pᵢ)]`.
Probabilities are clamped to `[eps, 1 − eps]` (default `eps = 1e-15`, configurable)
so confident-but-wrong forecasts get a large finite penalty instead of `Infinity`.
**Lower is better.**

### `calibrationCurve(samples, opts?): CalibrationBin[]`

Groups forecasts into `bins` equal-width probability bins (default `10`) and
returns, for each non-empty bin, the mean forecast (`meanPredicted`) and the
observed frequency of positives (`observedFrequency`). Plot `observedFrequency`
against `meanPredicted` to draw a **reliability diagram**; a perfectly calibrated
forecaster lies on the diagonal. Empty bins are omitted.

### `expectedCalibrationError(samples, opts?): number`

Sample-weighted average gap between confidence and observed frequency across bins:
`ECE = Σ (countᵦ / N) · |meanPredictedᵦ − observedFrequencyᵦ|`.
Range `[0, 1]`; `0` means every bin is perfectly calibrated. **Lower is better.**

### `brierDecomposition(samples, opts?): { reliability, resolution, uncertainty }`

The Murphy (1973) decomposition of the Brier score:

```
brierScore = reliability − resolution + uncertainty
```

- **reliability** — mean squared gap between forecast and observed frequency per
  bin (calibration error; **lower is better**).
- **resolution** — how much bin outcome frequencies vary around the base rate
  (discrimination; **higher is better**).
- **uncertainty** — `baseRate · (1 − baseRate)`, the intrinsic variance of the
  outcome; a property of the data, not of the forecasts.

The identity holds exactly when forecasts are constant within each bin and
approximately otherwise (the gap is the within-bin variance of the forecasts,
which shrinks as `bins` grows) — the standard behaviour of the binned Brier
decomposition.

## Choosing a metric

| Metric                  | Answers                                             | Notes                                                                                  |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Brier score**         | How far are probabilities from outcomes overall?    | Bounded `[0, 1]`, interpretable, penalises quadratically. A good default.              |
| **Log loss**            | How surprised is the forecaster?                    | Penalises confident mistakes far more harshly; unbounded. Common for ML training/eval. |
| **ECE**                 | Do stated probabilities match observed frequencies? | Pure calibration; ignores discrimination. Depends on the number of bins.               |
| **Calibration curve**   | _Where_ is the forecaster over/under-confident?     | Diagnostic, not a single number. Feeds a reliability diagram.                          |
| **Brier decomposition** | _Why_ is the Brier score what it is?                | Separates calibration (reliability) from discrimination (resolution).                  |

Brier score and log loss are **proper scoring rules**: they are optimised by
reporting your true beliefs. Use Brier for a bounded, robust overall score;
use log loss when confident errors should be punished hard; use ECE and the
calibration curve when you specifically care about whether "70%" really happens
70% of the time.

## CLI

Score a JSON dataset without writing any code. Input is a JSON array of
`{ "p": <0..1>, "outcome": <0|1> }`, read from a file argument or from stdin.

```bash
# From a file
npx forecast-calibration-kit data.json

# From stdin
echo '[{"p":0.9,"outcome":1},{"p":0.2,"outcome":0}]' | npx forecast-calibration-kit

# Options
npx forecast-calibration-kit data.json --bins 5 --format json
```

Options:

| Flag              | Description                                   | Default |
| ----------------- | --------------------------------------------- | ------- |
| `--bins <n>`      | Number of probability bins for calibration    | `10`    |
| `--format <fmt>`  | Output format: `table` or `json`              | `table` |
| `--eps <e>`       | Probability clamp for log loss, in `(0, 0.5)` | `1e-15` |
| `-h`, `--help`    | Show help                                     |         |
| `-v`, `--version` | Show version                                  |         |

Example table output:

```
Forecast calibration report
===========================
Samples:    20
Base rate:  0.6000

Metric                        Value
--------------------------------------
Brier score                   0.1974
Log loss                      0.5775
Expected calibration error    0.0965

Brier decomposition (Brier = reliability - resolution + uncertainty)
  reliability                 0.0147
  resolution                  0.0608
  uncertainty                 0.2400

Calibration curve (5 non-empty bin(s))
  bin mid   mean pred   obs freq    count
  ---------------------------------------
  0.1000    0.1000      0.0000      2
  ...
```

The CLI exits `0` on success, `1` on a data error (unreadable file, invalid JSON,
out-of-range values), and `2` on a usage error (unknown flag, no input).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for how to
set up the project, run the checks, and open a pull request.

## License

[MIT](./LICENSE) © Donizeti Ferreira
