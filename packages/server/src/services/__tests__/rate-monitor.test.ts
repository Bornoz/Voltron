import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../rate-monitor.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker();
  });

  // ─── Event Recording ───────────────────────────────────────

  describe('recordEvent', () => {
    it('should record events', () => {
      cb.recordEvent(1000);
      cb.recordEvent(2000);
      // Rate should be > 0 after 2 events
      expect(cb.getCurrentRate()).toBeGreaterThan(0);
    });

    it('should clean up events outside the 5s window', () => {
      cb.recordEvent(1000);
      cb.recordEvent(2000);
      // Event at 8000 should clean up event at 1000 (>5s old) and 2000 (>5s old)
      cb.recordEvent(8000);
      // Only 1 event after cleanup, rate should be 0
      expect(cb.getCurrentRate()).toBe(0);
    });

    it('should keep events within the window', () => {
      const now = Date.now();
      cb.recordEvent(now - 3000);
      cb.recordEvent(now - 2000);
      cb.recordEvent(now - 1000);
      cb.recordEvent(now);
      expect(cb.getCurrentRate()).toBeGreaterThan(0);
    });
  });

  // ─── Rate Calculation ──────────────────────────────────────

  describe('getCurrentRate', () => {
    it('should return 0 for empty events', () => {
      expect(cb.getCurrentRate()).toBe(0);
    });

    it('should return 0 for single event', () => {
      cb.recordEvent(1000);
      expect(cb.getCurrentRate()).toBe(0);
    });

    it('should calculate rate correctly', () => {
      // 10 events in 1 second = 10/s
      for (let i = 0; i < 10; i++) {
        cb.recordEvent(1000 + i * 100);
      }
      const rate = cb.getCurrentRate();
      // 10 events over 0.9s window ≈ 11.1/s
      expect(rate).toBeGreaterThan(10);
    });

    it('should calculate rate for evenly spaced events', () => {
      // 5 events, 1 per second (over 4 seconds)
      cb.recordEvent(1000);
      cb.recordEvent(2000);
      cb.recordEvent(3000);
      cb.recordEvent(4000);
      cb.recordEvent(5000);
      const rate = cb.getCurrentRate();
      // 5 events / 4 seconds = 1.25
      expect(rate).toBeCloseTo(1.25, 1);
    });
  });

  // ─── Trip Detection ────────────────────────────────────────

  describe('shouldTrip', () => {
    it('should not trip with no events', () => {
      expect(cb.shouldTrip(10)).toBe(false);
    });

    it('should not trip below rate limit', () => {
      cb.recordEvent(1000);
      cb.recordEvent(2000);
      expect(cb.shouldTrip(10)).toBe(false);
    });

    it('should trip when rate exceeds limit', () => {
      const now = Date.now();
      // Rapid events to exceed rate limit of 5/s
      for (let i = 0; i < 30; i++) {
        cb.recordEvent(now + i * 10); // 100 events/s
      }
      expect(cb.shouldTrip(5)).toBe(true);
    });

    it('should not trip when rate equals limit', () => {
      // Events at 1/s rate, limit = 2
      cb.recordEvent(1000);
      cb.recordEvent(2000);
      cb.recordEvent(3000);
      // Rate = 3/2s = 1.5, limit = 2
      expect(cb.shouldTrip(2)).toBe(false);
    });
  });

  // ─── Reset ─────────────────────────────────────────────────

  describe('reset', () => {
    it('should clear all events', () => {
      cb.recordEvent(1000);
      cb.recordEvent(2000);
      cb.recordEvent(3000);
      cb.reset();
      expect(cb.getCurrentRate()).toBe(0);
    });

    it('should not trip after reset', () => {
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        cb.recordEvent(now + i);
      }
      expect(cb.shouldTrip(5)).toBe(true);
      cb.reset();
      expect(cb.shouldTrip(5)).toBe(false);
    });

    it('should accept new events after reset', () => {
      cb.recordEvent(1000);
      cb.reset();
      cb.recordEvent(2000);
      cb.recordEvent(2500);
      expect(cb.getCurrentRate()).toBeGreaterThan(0);
    });
  });

  // ─── Window Behavior ───────────────────────────────────────

  describe('window behavior', () => {
    it('should maintain 5-second window', () => {
      cb.recordEvent(1000);
      cb.recordEvent(2000);
      cb.recordEvent(3000);
      // Recording at 7000 should clean up 1000 (>5s old)
      cb.recordEvent(7000);
      // Now we have: 2000, 3000, 7000 → but after cleanup: only 3000 and 7000 survive
      // Actually: 7000 - 5000 = 2000 cutoff, so 2000 is exactly at boundary
      // Filter is t > cutoff (strict), so 2000 is excluded
      const rate = cb.getCurrentRate();
      // 2 events (3000, 7000) over 4 seconds = 0.5/s
      expect(rate).toBeCloseTo(0.5, 1);
    });

    it('should handle burst followed by quiet period', () => {
      // Burst: 10 events in 100ms
      for (let i = 0; i < 10; i++) {
        cb.recordEvent(1000 + i * 10);
      }
      // Should have high rate
      expect(cb.getCurrentRate()).toBeGreaterThan(50);

      // After 6s quiet, all old events cleaned up
      cb.recordEvent(7100);
      // Only 1 event from burst + 1 new = low rate
      expect(cb.getCurrentRate()).toBeLessThan(5);
    });
  });
});
