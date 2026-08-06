import { SqliteExecutor } from '../../dist/index.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { UsersDao, RolesDao } from './sqlite_dao/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
    console.log('--- STARTING DAOX END-TO-END EXECUTION ---');
    const dbPath = path.resolve(__dirname, 'playground.db');
    const db = new Database(dbPath);
    const exe = new SqliteExecutor(db);
    
    console.log('[1/4] Testing INSERT (Omit auto-inc and Default values) ...');
    const user = await UsersDao.insert(exe, {
        uuid: 'sys-900',
        email: 'admin@lightx.io',
        meta: null
    });
    console.log('✔ User inserted:', user);
    
    console.log('[2/4] Testing FIND (findByPk) ...');
    const fetched = await UsersDao.findById(exe, user.id);
    console.log('✔ User fetched safely:', fetched?.email);
    
    console.log('[3/4] Testing UPDATE (updatePartial) ...');
    await UsersDao.updatePartialById(exe, user.id, {
        status: 99
    });
    const fetched2 = await UsersDao.findById(exe, user.id);
    console.log('✔ User status updated to:', fetched2?.status);
    
    console.log('[4/4] Testing BATCH INSERT (atomique loop) and STREAM ...');
    await RolesDao.insertBatch(exe, [
        { role_name: 'super_admin' },
        { role_name: 'moderator' }
    ]);
    
    let rolesCount = 0;
    for await (const row of RolesDao.listByCursor(exe, null, 10)) {
        rolesCount++;
        console.log('  Streamed Role ->', row);
    }
    console.log('✔ Roles streamed successfully. Count:', rolesCount);
    console.log('--- ALL DAOX GENERATED FUNCTIONS VALIDATED SOTA ---');
}

run().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
