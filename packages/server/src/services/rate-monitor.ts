export class CircuitBreaker {
  private eventTimestamps: number[] = [];
  private readonly windowMs = 5000;

  recordEvent(timestamp: number): void {
    this.eventTimestamps.push(timestamp);
    const cutoff = timestamp - this.windowMs;
    this.eventTimestamps = this.eventTimestamps.filter(t => t > cutoff);
  }

  getCurrentRate(): number {
    if (this.eventTimestamps.length < 2) return 0;
    const windowStart = this.eventTimestamps[0];
    const windowEnd = this.eventTimestamps[this.eventTimestamps.length - 1];
    const durationSec = (windowEnd - windowStart) / 1000;
    return durationSec > 0 ? this.eventTimestamps.length / durationSec : 0;
  }

  shouldTrip(rateLimit: number): boolean {
    return this.getCurrentRate() > rateLimit;
  }

  reset(): void {
    this.eventTimestamps = [];
  }
}
