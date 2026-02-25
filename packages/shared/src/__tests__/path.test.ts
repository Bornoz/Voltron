import { describe, it, expect } from 'vitest';
import { normalizePath, relativePath, isInsidePath, getFileExtension, splitPath } from '../utils/path.js';

describe('normalizePath', () => {
  it('should normalize forward slashes', () => {
    expect(normalizePath('src/utils/path.ts')).toBe('src/utils/path.ts');
  });

  it('should resolve double dots', () => {
    expect(normalizePath('src/utils/../path.ts')).toBe('src/path.ts');
  });

  it('should resolve double slashes', () => {
    expect(normalizePath('src//utils//path.ts')).toBe('src/utils/path.ts');
  });

  it('should handle absolute paths', () => {
    const result = normalizePath('/opt/voltron/src/index.ts');
    expect(result).toBe('/opt/voltron/src/index.ts');
  });

  it('should handle dot path', () => {
    expect(normalizePath('./src/app.ts')).toBe('src/app.ts');
  });

  it('should handle empty string', () => {
    expect(normalizePath('')).toBe('.');
  });
});

describe('relativePath', () => {
  it('should return relative path', () => {
    const result = relativePath('/opt/voltron', '/opt/voltron/src/index.ts');
    expect(result).toBe('src/index.ts');
  });

  it('should handle same directory', () => {
    expect(relativePath('/opt/voltron', '/opt/voltron')).toBe('');
  });

  it('should handle parent directory traversal', () => {
    const result = relativePath('/opt/voltron/src', '/opt/voltron/package.json');
    expect(result).toBe('../package.json');
  });
});

describe('isInsidePath', () => {
  it('should return true for nested paths', () => {
    expect(isInsidePath('/opt/voltron', '/opt/voltron/src/index.ts')).toBe(true);
  });

  it('should return false for outside paths', () => {
    expect(isInsidePath('/opt/voltron', '/etc/nginx/conf')).toBe(false);
  });

  it('should return true for same path', () => {
    expect(isInsidePath('/opt/voltron', '/opt/voltron')).toBe(true);
  });

  it('should return false for parent path', () => {
    expect(isInsidePath('/opt/voltron/src', '/opt/voltron')).toBe(false);
  });

  it('should handle traversal attempts', () => {
    expect(isInsidePath('/opt/voltron', '/opt/voltron/../../etc/passwd')).toBe(false);
  });
});

describe('getFileExtension', () => {
  it('should return extension with dot', () => {
    expect(getFileExtension('file.ts')).toBe('.ts');
  });

  it('should return last extension for multi-dot files', () => {
    expect(getFileExtension('file.test.ts')).toBe('.ts');
  });

  it('should return empty string for no extension', () => {
    expect(getFileExtension('Makefile')).toBe('');
  });

  it('should handle paths with directories', () => {
    expect(getFileExtension('src/components/Button.tsx')).toBe('.tsx');
  });

  it('should handle dotfiles', () => {
    expect(getFileExtension('.gitignore')).toBe('.gitignore');
  });
});

describe('splitPath', () => {
  it('should split path into segments', () => {
    expect(splitPath('src/utils/path.ts')).toEqual(['src', 'utils', 'path.ts']);
  });

  it('should handle absolute paths', () => {
    expect(splitPath('/opt/voltron/src')).toEqual(['opt', 'voltron', 'src']);
  });

  it('should handle single segment', () => {
    expect(splitPath('file.ts')).toEqual(['file.ts']);
  });

  it('should filter empty segments', () => {
    expect(splitPath('src//utils')).toEqual(['src', 'utils']);
  });

  it('should handle root path', () => {
    expect(splitPath('/')).toEqual([]);
  });
});
