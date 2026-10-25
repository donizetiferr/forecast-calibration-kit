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
}
