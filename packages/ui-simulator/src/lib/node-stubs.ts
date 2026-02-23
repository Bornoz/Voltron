// Stubs for Node.js builtins that @voltron/shared re-exports but the simulator never uses.
// These functions are tree-shaken away, but Rollup still needs them to resolve.

export function createHash() {
  throw new Error('node:crypto not available in browser');
}

export function createReadStream() {
  throw new Error('node:fs not available in browser');
}

export function join(...args: string[]) {
  return args.join('/');
}

export function resolve(...args: string[]) {
  return args.join('/');
}

export function relative(_from: string, to: string) {
  return to;
}

export function dirname(p: string) {
  return p.split('/').slice(0, -1).join('/');
}

export function basename(p: string) {
  const parts = p.split('/');
  return parts[parts.length - 1];
}

export function extname(p: string) {
  const base = basename(p);
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i) : '';
}

export function normalize(p: string) {
  return p;
}

export function isAbsolute(p: string) {
  return p.startsWith('/');
}

export const sep = '/';
export const posix = { sep: '/' };

export default {
  createHash,
  createReadStream,
  join,
  resolve,
  relative,
  dirname,
  basename,
  extname,
  normalize,
  isAbsolute,
  sep,
  posix,
};
