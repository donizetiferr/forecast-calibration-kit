/** Compensated summation for finite metric contributions. @internal */
export class CompensatedSum {
  private sum = 0;
  private correction = 0;

  add(value: number): void {
    const next = this.sum + value;
    // Neumaier's correction also handles a new term larger than the running sum.
    this.correction +=
      Math.abs(this.sum) >= Math.abs(value) ? this.sum - next + value : value - next + this.sum;
    this.sum = next;
  }

  value(): number {
    return this.sum + this.correction;
  }

  /** Divides without discarding the low-order part of the accumulated sum. */
  mean(count: number): number {
    const quotient = this.sum / count;
    const product = quotient * count;
    // Dekker's split recovers the rounding error in quotient * count.
    // Counts are array lengths and metric terms are bounded, so these
    // intermediate products cannot overflow.
    const splitter = 2 ** 27 + 1;
    const splitQuotient = splitter * quotient;
    const quotientHigh = splitQuotient - (splitQuotient - quotient);
    const quotientLow = quotient - quotientHigh;
    const splitCount = splitter * count;
    const countHigh = splitCount - (splitCount - count);
    const countLow = count - countHigh;
    const productError =
      quotientHigh * countHigh -
      product +
      quotientHigh * countLow +
      quotientLow * countHigh +
      quotientLow * countLow;
    const remainder = this.sum - product - productError + this.correction;
    return quotient + remainder / count;
  }
}
