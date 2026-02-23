import { simpleGit } from 'simple-git';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_DIFF_SIZE = 1_048_576; // 1MB
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.mp4', '.mp3', '.wav', '.ogg', '.webm',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.woff', '.woff2', '.ttf', '.eot',
  '.sqlite', '.db',
]);

export class DiffGenerator {
  private git;

  constructor(private projectRoot: string, private maxFileSize: number) {
    this.git = simpleGit(projectRoot);
  }

  async generate(relPath: string): Promise<{ diff: string | undefined; isBinary: boolean; diffTruncated: boolean; fileSize: number | undefined }> {
    const fullPath = join(this.projectRoot, relPath);
    const ext = relPath.includes('.') ? `.${relPath.split('.').pop()!.toLowerCase()}` : '';

    // Binary detection
    if (BINARY_EXTENSIONS.has(ext)) {
      return { diff: undefined, isBinary: true, diffTruncated: false, fileSize: this.getFileSize(fullPath) };
    }

    // Size check
    const fileSize = this.getFileSize(fullPath);
    if (fileSize !== undefined && fileSize > this.maxFileSize) {
      return { diff: undefined, isBinary: false, diffTruncated: true, fileSize };
    }

    try {
      const diffOutput = await this.git.diff(['--unified=3', '--', relPath]);
      if (!diffOutput) {
        // Might be untracked file, try diff against /dev/null
        const stagedDiff = await this.git.diff(['--unified=3', '--cached', '--', relPath]);
        if (stagedDiff) {
          const truncated = stagedDiff.length > MAX_DIFF_SIZE;
          return {
            diff: truncated ? stagedDiff.slice(0, MAX_DIFF_SIZE) : stagedDiff,
            isBinary: false, diffTruncated: truncated, fileSize,
          };
        }
        return { diff: undefined, isBinary: false, diffTruncated: false, fileSize };
      }

      const truncated = diffOutput.length > MAX_DIFF_SIZE;
      return {
        diff: truncated ? diffOutput.slice(0, MAX_DIFF_SIZE) : diffOutput,
        isBinary: false, diffTruncated: truncated, fileSize,
      };
    } catch {
      return { diff: undefined, isBinary: false, diffTruncated: false, fileSize };
    }
  }

  private getFileSize(fullPath: string): number | undefined {
    try {
      return statSync(fullPath).size;
    } catch {
      return undefined;
    }
  }
}
