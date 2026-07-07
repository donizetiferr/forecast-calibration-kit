import type { Sample } from '../types';

/**
 * Aggregate statistics for a single probability bin.
 * @internal
 */
export interface BinAggregate {
  /** Number of samples that fell into the bin. */
  count: number;
  /** Sum of forecast probabilities in the bin. */
  sumP: number;
  /** Sum of outcomes (i.e. number of positive outcomes) in the bin. */
  sumOutcome: number;
}

/**
 * Partitions samples into `bins` equal-width bins over `[0, 1]`.
 *
 * The bin index of a probability `p` is `min(floor(p * bins), bins - 1)`, so that
 * `p = 1` falls into the last bin. Returns one aggregate per bin (length `bins`);
 * empty bins have `count === 0`.
 *
 * @internal
 */
export function binSamples(samples: readonly Sample[], bins: number): BinAggregate[] {
  const aggregates: BinAggregate[] = Array.from({ length: bins }, () => ({
    count: 0,
    sumP: 0,
    sumOutcome: 0,
  }));

  for (const { p, outcome } of samples) {
    const index = Math.min(Math.floor(p * bins), bins - 1);
    const bin = aggregates[index]!;
    bin.count += 1;
    bin.sumP += p;
    bin.sumOutcome += outcome;
  }

  return aggregates;
}

/**
 * The nominal midpoint of bin `index` given `bins` equal-width bins.
 * @internal
 */
export function binMidpoint(index: number, bins: number): number {
  return (index + 0.5) / bins;
}
