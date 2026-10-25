import type { Sample } from '../types';
import { CompensatedSum } from './_sum';

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
 * Bin `k` covers `[k / bins, (k + 1) / bins)`, with `p = 1` included in the
 * last bin. Returns only occupied bins, sorted by index.
 * Storage depends on the number of occupied bins rather than the resolution.
 *
 * @internal
 */
export function binSamples(samples: readonly Sample[], bins: number): BinAggregate[] {
  const aggregates = new Map<number, Omit<BinAggregate, 'sumP'> & { sumP: CompensatedSum }>();

  for (const { p, outcome } of samples) {
    let index = Math.min(Math.floor(p * bins), bins - 1);
    // Multiplication may round a value across a boundary in either direction.
    // Compare with the actual interval endpoints to correct that one-bin error.
    if (p < index / bins) {
      index -= 1;
    } else if (index < bins - 1 && p >= (index + 1) / bins) {
      index += 1;
    }
    let bin = aggregates.get(index);
    if (bin === undefined) {
      bin = { index, count: 0, sumP: new CompensatedSum(), sumOutcome: 0 };
      aggregates.set(index, bin);
    }
    bin.count += 1;
    bin.sumP.add(p);
    bin.sumOutcome += outcome;
  }

  return [...aggregates.values()]
    .sort((a, b) => a.index - b.index)
    .map((bin) => ({ ...bin, sumP: bin.sumP.value() }));
}

/**
 * The nominal midpoint of bin `index` given `bins` equal-width bins.
 * @internal
 */
export function binMidpoint(index: number, bins: number): number {
  return (index + 0.5) / bins;
}
