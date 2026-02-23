import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export function hashString(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashBuffer(input: Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
