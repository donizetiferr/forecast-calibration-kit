# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-07

### Added

- `brierScore` — Brier score (mean squared error of probabilistic forecasts).
- `logLoss` — logarithmic loss / binary cross-entropy, with a configurable `eps`
  clamp to keep confident-but-wrong forecasts finite.
- `calibrationCurve` — reliability-diagram bins with mean predicted probability
  and observed frequency per bin.
- `expectedCalibrationError` — sample-weighted calibration gap (ECE).
- `brierDecomposition` — Murphy decomposition of the Brier score into
  reliability, resolution and uncertainty.
- `CalibrationError` — thrown on invalid input at the API boundary.
- Command-line interface: score a JSON dataset from a file or stdin, with
  `--bins`, `--format table|json`, and `--eps` options.
- Dual ESM + CommonJS builds with TypeScript type declarations.
- Zero runtime dependencies.

[0.1.0]: https://github.com/donizetiferr/forecast-calibration-kit/releases/tag/v0.1.0
