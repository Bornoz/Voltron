import { format, formatDistanceToNow, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

/**
 * Format a timestamp to a readable date string.
 */
export function formatDate(timestamp: number | Date, pattern = 'dd MMM yyyy HH:mm:ss'): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (!isValid(date)) return '-';
  return format(date, pattern, { locale: tr });
}

/**
 * Format a timestamp to relative time (e.g., "3 dakika once").
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (!isValid(date)) return '-';
  return formatDistanceToNow(date, { addSuffix: true, locale: tr });
}

/**
 * Format bytes to human-readable file size.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Truncate a long file path, keeping the filename and last directory.
 */
export function formatPath(path: string, maxLength = 50): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) {
    return `...${path.slice(-maxLength + 3)}`;
  }
  const filename = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  const prefix = parts[0] === '' ? '/' : parts[0];
  const shortened = `${prefix}/.../${parent}/${filename}`;
  if (shortened.length > maxLength) {
    return `.../${parent}/${filename}`;
  }
  return shortened;
}
