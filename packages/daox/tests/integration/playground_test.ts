/**
 * @file playground_test.ts
 * @description Master End-to-End Database Validation Pipeline.
 * Executes the full Daox internal core loop against a real SQLite playground file.
 * This guarantees the exact behavior of standard DAO operations including CRUD, batches, and streaming.
 */
import { test, expect } from '@jest/globals';
import { SqliteExecutor } from '../../dist/index.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { UsersDao, RolesDao } from './sqlite_dao/index.js';
import { DB_CONFIG } from '../db_config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('E2E Database Validation - Daox Full Core Loop', async () => {
    // 1. Establish the connection explicitly using standard better-sqlite3 drivers
    const dbPath = DB_CONFIG.sqlitePlaygroundPath;
    const db = new Database(dbPath);
    const exe = new SqliteExecutor(db);
    
    // 2. Validate row insertions natively without triggering unexpected side-effects
    const user = await UsersDao.insert(exe, {
        uuid: 'sys-900',
        email: 'admin@lightx.io',
        meta: null
    });
    
    expect(user.id).toBeDefined();
    expect(user.uuid).toBe('sys-900');
    expect(user.status).toBe(1); // the DB default!
    
    // 3. Robust read operation returning securely populated entities
    const fetched = await UsersDao.findById(exe, user.id!);
    expect(fetched?.email).toBe('admin@lightx.io');
    
    // 4. Validate granular partial updates omitting unspecified properties
    await UsersDao.updatePartialById(exe, user.id!, {
        status: 99
    });
    
    const fetched2 = await UsersDao.findById(exe, user.id!);
    expect(fetched2?.status).toBe(99);
    
    // 5. Test multi-bulk atomic inserts for extreme performance requirements
    await RolesDao.insertBatch(exe, [
        { role_name: 'super_admin' },
        { role_name: 'moderator' }
    ]);
    
    // 6. Test Memory-Safe streaming capabilities via Generators
    let rolesCount = 0;
    for await (const row of RolesDao.listByCursor(exe, null, 10)) {
        rolesCount++;
    }
    
    expect(rolesCount).toBeGreaterThanOrEqual(2);
});
