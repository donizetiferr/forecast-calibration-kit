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

  /** Adds a weighted contribution without rounding away the product's low part. */
  addProduct(value: number, weight: number): void {
    const product = value * weight;
    this.add(product);
    this.add(productError(value, weight, product));
  }

  /** Divides without discarding the low-order part of the accumulated sum. */
  mean(count: number): number {
    const quotient = this.sum / count;
    const product = quotient * count;
    const remainder = this.sum - product - productError(quotient, count, product) + this.correction;
    return quotient + remainder / count;
  }
}

/** Dekker's split recovers the low-order part of a finite product. */
function productError(value: number, weight: number, product: number): number {
  // Metric values and safe-integer counts keep the split products finite.
  const splitter = 2 ** 27 + 1;
  const splitValue = splitter * value;
  const valueHigh = splitValue - (splitValue - value);
  const valueLow = value - valueHigh;
  const splitWeight = splitter * weight;
  const weightHigh = splitWeight - (splitWeight - weight);
  const weightLow = weight - weightHigh;
  return (
    valueHigh * weightHigh -
    product +
    valueHigh * weightLow +
    valueLow * weightHigh +
    valueLow * weightLow
  );
}
