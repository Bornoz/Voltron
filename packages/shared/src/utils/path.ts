import { normalize, relative, isAbsolute, sep } from 'node:path';

export function normalizePath(filePath: string): string {
  return normalize(filePath).replace(/\\/g, '/');
}

export function relativePath(from: string, to: string): string {
  return relative(from, to).replace(/\\/g, '/');
}

export function isInsidePath(parentDir: string, childPath: string): boolean {
  const rel = relative(parentDir, childPath);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

export function splitPath(filePath: string): string[] {
  return normalizePath(filePath).split('/').filter(Boolean);
}
