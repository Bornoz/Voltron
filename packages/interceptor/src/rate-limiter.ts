export class RateLimiter {
  private timestamps: number[] = [];
  private readonly windowMs = 5000;

  record(timestamp: number): void {
    this.timestamps.push(timestamp);
    const cutoff = timestamp - this.windowMs;
    this.timestamps = this.timestamps.filter(t => t > cutoff);
  }

  getCurrentRate(): number {
    if (this.timestamps.length < 2) return 0;
    const start = this.timestamps[0];
    const end = this.timestamps[this.timestamps.length - 1];
    const sec = (end - start) / 1000;
    return sec > 0 ? this.timestamps.length / sec : 0;
  }

  isExceeded(limit: number): boolean {
    return this.getCurrentRate() > limit;
  }

  reset(): void {
    this.timestamps = [];
  }
}
