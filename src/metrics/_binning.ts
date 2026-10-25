import type { Sample } from '../types';

/**
 * Aggregate statistics for a single probability bin.
 * @internal
 */
export interface BinAggregate {
  /** Index of the occupied bin in the equal-width partition. */
  index: number;
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
 * `p = 1` falls into the last bin. Returns only occupied bins, sorted by index.
 * Storage depends on the number of occupied bins rather than the resolution.
 *
 * @internal
 */
export function binSamples(samples: readonly Sample[], bins: number): BinAggregate[] {
  const aggregates = new Map<number, BinAggregate>();

  for (const { p, outcome } of samples) {
    const index = Math.min(Math.floor(p * bins), bins - 1);
    let bin = aggregates.get(index);
    if (bin === undefined) {
      bin = { index, count: 0, sumP: 0, sumOutcome: 0 };
      aggregates.set(index, bin);
    }
    bin.count += 1;
    bin.sumP += p;
    bin.sumOutcome += outcome;
  }

  return [...aggregates.values()].sort((a, b) => a.index - b.index);
}

/**
 * The nominal midpoint of bin `index` given `bins` equal-width bins.
 * @internal
 */
export function binMidpoint(index: number, bins: number): number {
  return (index + 0.5) / bins;
}
