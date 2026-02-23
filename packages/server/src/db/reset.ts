import { unlinkSync, existsSync } from 'node:fs';
import { loadConfig } from '../config.js';

const config = loadConfig();
const files = [config.dbPath, `${config.dbPath}-wal`, `${config.dbPath}-shm`];

for (const f of files) {
  if (existsSync(f)) {
    unlinkSync(f);
    console.log(`Deleted: ${f}`);
  }
}
console.log('Database reset complete.');
