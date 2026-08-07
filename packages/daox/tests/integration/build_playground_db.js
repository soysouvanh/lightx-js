import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'playground.db');
// Remarque: Géré aussi centralement via DB_CONFIG.sqlitePlaygroundPath dans tests/db_config.ts
const db = new Database(dbPath);

import fs from 'node:fs';

const sqlScript = fs.readFileSync(path.resolve(__dirname, 'setup/init_sqlite.sql'), 'utf-8');

console.log('Building complex SQLite database scheme...');
db.exec(sqlScript);

db.close();
console.log('Database successfully built at playground.db');
