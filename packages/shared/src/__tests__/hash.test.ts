import { describe, it, expect } from 'vitest';
import { hashString, hashBuffer } from '../utils/hash.js';

describe('hashString', () => {
  it('should return a 64-character hex string', () => {
    const result = hashString('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should return consistent hash for same input', () => {
    expect(hashString('test')).toBe(hashString('test'));
  });

  it('should return different hashes for different inputs', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('should handle empty string', () => {
    const result = hashString('');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should handle unicode characters', () => {
    const result = hashString('merhaba dünya 🌍');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should handle long strings', () => {
    const longStr = 'a'.repeat(100_000);
    const result = hashString(longStr);
    expect(result).toHaveLength(64);
  });

  it('should produce known SHA-256 hash for "hello"', () => {
    // SHA-256 of "hello" is well-known
    expect(hashString('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('hashBuffer', () => {
  it('should return a 64-character hex string', () => {
    const result = hashBuffer(Buffer.from('hello'));
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should return consistent hash for same input', () => {
    const buf = Buffer.from('test data');
    expect(hashBuffer(buf)).toBe(hashBuffer(Buffer.from('test data')));
  });

  it('should return different hashes for different inputs', () => {
    expect(hashBuffer(Buffer.from('hello'))).not.toBe(hashBuffer(Buffer.from('world')));
  });

  it('should produce same hash as hashString for same content', () => {
    const text = 'same content';
    expect(hashString(text)).toBe(hashBuffer(Buffer.from(text, 'utf8')));
  });

  it('should handle empty buffer', () => {
    const result = hashBuffer(Buffer.alloc(0));
    expect(result).toHaveLength(64);
  });

  it('should handle binary data', () => {
    const binaryBuf = Buffer.from([0x00, 0xFF, 0x80, 0x7F, 0x01]);
    const result = hashBuffer(binaryBuf);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});
