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
  /** Mean forecast probability in the bin. */
  meanPredicted: number;
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
  const aggregates = new Map<
    number,
    Omit<BinAggregate, 'meanPredicted'> & { sumP: CompensatedSum }
  >();

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
    .map(({ index, count, sumP, sumOutcome }) => ({
      index,
      count,
      meanPredicted: sumP.mean(count),
      sumOutcome,
    }));
}

/**
 * The nominal midpoint of bin `index` given `bins` equal-width bins.
 * @internal
 */
export function binMidpoint(index: number, bins: number): number {
  if (index >= 2 ** 52) {
    // At these indices, adding 0.5 rounds to an integer before division.
    // Keep the half-bin contribution through the compensated mean instead.
    const numerator = new CompensatedSum();
    numerator.add(index);
    numerator.add(0.5);
    return numerator.mean(bins);
  }
  return (index + 0.5) / bins;
}

/** Absolute calibration gap without cancellation near probability one. @internal */
export function binCalibrationGap(
  meanPredicted: number,
  sumOutcome: number,
  count: number,
): number {
  const observedFrequency = sumOutcome / count;
  // Preserve exact calibration as represented by the public curve, including
  // non-dyadic frequencies such as 7/10 paired with a mean forecast of 0.7.
  if (meanPredicted === observedFrequency) return 0;
  return Math.abs(
    meanPredicted <= 0.5
      ? meanPredicted - observedFrequency
      : (count - sumOutcome) / count - (1 - meanPredicted),
  );
}
