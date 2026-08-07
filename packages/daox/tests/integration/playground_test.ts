import { test, expect } from '@jest/globals';
import { SqliteExecutor } from '../../dist/index.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { UsersDao, RolesDao } from './playground_daox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { DB_CONFIG } from '../db_config.js';

test('E2E Database Validation - Daox Full Core Loop', async () => {
    const dbPath = DB_CONFIG.sqlitePlaygroundPath;
    const db = new Database(dbPath);
    const exe = new SqliteExecutor(db);
    
    // 1. Test insertion with omitted defaults / auto increments
    const user = await UsersDao.insert(exe, {
        uuid: 'sys-900',
        email: 'admin@lightx.io'
    });
    
    expect(user.id).toBeDefined();
    expect(user.uuid).toBe('sys-900');
    expect(user.status).toBe(1); // the DB default!
    
    // 2. Test fetching 
    const fetched = await UsersDao.findById(exe, user.id);
    expect(fetched?.email).toBe('admin@lightx.io');
    
    // 3. Test updating partial payload
    await UsersDao.updatePartialById(exe, user.id, {
        status: 99
    });
    
    const fetched2 = await UsersDao.findById(exe, user.id);
    expect(fetched2?.status).toBe(99);
    
    // 4. Test multi bulk insert atomique
    await RolesDao.insertBatch(exe, [
        { role_name: 'super_admin' },
        { role_name: 'moderator' }
    ]);
    
    let rolesCount = 0;
    for await (const row of RolesDao.listByCursor(exe, null, 10)) {
        rolesCount++;
    }
    expect(rolesCount).toBe(2);
});
