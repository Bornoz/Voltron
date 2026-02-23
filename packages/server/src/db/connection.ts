import Database from 'better-sqlite3';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

let db: Database.Database | null = null;
let dbFilePath: string | null = null;
let snapshotCounter = 0;
const BACKUP_EVERY_N_SNAPSHOTS = 100;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function initDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  dbFilePath = dbPath;

  db = new Database(dbPath);

  // Performance & safety pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB
  db.pragma('busy_timeout = 5000');

  // Integrity check at startup
  const integrityResult = db.pragma('integrity_check') as { integrity_check: string }[];
  const ok = integrityResult.length === 1 && integrityResult[0].integrity_check === 'ok';
  if (!ok) {
    const issues = integrityResult.map(r => r.integrity_check).join('; ');
    // Log but don't throw - allow degraded operation with warning
    console.error(`[DB] INTEGRITY CHECK FAILED: ${issues}`);
    // Attempt immediate backup of potentially corrupted DB for forensics
    try {
      const corruptBackup = `${dbPath}.corrupt.${Date.now()}`;
      copyFileSync(dbPath, corruptBackup);
      console.error(`[DB] Corrupt DB backed up to: ${corruptBackup}`);
    } catch { /* best effort */ }
  }

  return db;
}

/**
 * Notify the backup system that a snapshot was written.
 * Triggers a periodic backup every BACKUP_EVERY_N_SNAPSHOTS calls.
 */
export function notifySnapshotWritten(): void {
  snapshotCounter++;
  if (snapshotCounter >= BACKUP_EVERY_N_SNAPSHOTS) {
    snapshotCounter = 0;
    performBackup();
  }
}

/**
 * Perform a hot backup using SQLite's backup API via VACUUM INTO.
 * WAL mode allows concurrent reads during backup.
 */
export function performBackup(): boolean {
  if (!db || !dbFilePath) return false;

  const backupDir = join(dirname(dbFilePath), 'backups');
  mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `voltron-backup-${timestamp}.db`);

  try {
    // VACUUM INTO creates a consistent snapshot without blocking writers
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    console.log(`[DB] Backup created: ${backupPath}`);

    // Rotate: keep only last 5 backups
    rotateBackups(backupDir, 5);
    return true;
  } catch (err) {
    console.error(`[DB] Backup failed:`, err);
    return false;
  }
}

function rotateBackups(backupDir: string, keep: number): void {
  try {
    const { readdirSync, unlinkSync } = require('node:fs');
    const files = (readdirSync(backupDir) as string[])
      .filter((f: string) => f.startsWith('voltron-backup-') && f.endsWith('.db'))
      .sort()
      .reverse();

    for (let i = keep; i < files.length; i++) {
      unlinkSync(join(backupDir, files[i]));
    }
  } catch { /* best effort rotation */ }
}

export function closeDb(): void {
  if (db) {
    // Checkpoint WAL before closing for clean state
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch { /* may fail if already closing */ }
    db.close();
    db = null;
    dbFilePath = null;
  }
}
