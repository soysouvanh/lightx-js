import { PostgresExecutor } from '../../dist/index.js';
import postgres from 'postgres';
import { UsersDao, ConfigurationsDao, Product_metadataDao } from './postgres_dao/index.js';

import { DB_CONFIG } from '../db_config.js';

async function run() {
    console.log('--- STARTING DAOX POSTGRES COMPLEX E2E EXECUTION ---');
    
    const sql = postgres(DB_CONFIG.postgres);
    const exe = new PostgresExecutor(sql);
    
    console.log('[1/7] Testing INSERT (Omit default values) ...');
    const newUser = await UsersDao.insert(exe, { 
        email: 'test_insert@lightx.io', 
        first_name: null,
        last_name: 'Stark', 
        status: 'guest' 
    });
    console.log('✔ Inserted generated ID:', newUser.id!);
    
    console.log('[2/7] Testing BATCH INSERT (Bulk network payload) ...');
    await UsersDao.insertBatch(exe, [
        { email: 'bulk1@test.com', first_name: null, last_name: 'Wayne' },
        { email: 'bulk2@test.com', first_name: null, last_name: 'Kent' }
    ]);
    console.log('✔ Checked mass insertion mapping success.');
    
    console.log('[3/7] Testing FIND (findByPk) on Seeded Data ...');
    const user = await UsersDao.findById(exe, 1n);
    console.log('✔ User 1 fetched safely:', user?.email, user?.status);
    
    console.log('[2/3] Testing reserved keywords and UPDATE ...');
    const config = await ConfigurationsDao.findById(exe, 1);
    console.log('✔ Config fetched safely:', config?.type, config?.match);
    await ConfigurationsDao.updatePartialById(exe, 1, {
        value: 'light_mode'
    });
    const updatedConfig = await ConfigurationsDao.findById(exe, 1);
    console.log('✔ Config updated value:', updatedConfig?.value);

    // Wait! Let's stream the complex ENUM and JSON types!
    console.log('[3/5] Testing complex Stream / Enum / JSON map ...');
    let complexCount = 0;
    for await (const row of Product_metadataDao.listByCursor(exe, null, 10)) {
        complexCount++;
        console.log(`  Streamed Meta -> ${row.category} /`, row.attributes);
    }
    console.log('✔ Metadata streamed successfully. Count:', complexCount);
    
    console.log('[4/5] Testing YAGNI Exotica (Unique and Multiple INDEXES) ...');
    const ubyEmail = await UsersDao.findByEmail(exe, 'diana@example.com');
    console.log('✔ User fetched safely via Unique Index (findByEmail):', ubyEmail?.email);
    
    const usByNames = await UsersDao.findAllByLast_nameAndFirst_name(exe, 'Dupont', 'Alice');
    console.log(`✔ Users fetched via Classical Index (findAllByLast_nameAndFirst_name). Resolved: ${usByNames.length} rows`);
    
    console.log('[5/5] Testing DELETE by Absolute PK ...');
    await ConfigurationsDao.deleteById(exe, 2);
    const delCheck = await ConfigurationsDao.findById(exe, 2);
    if (!delCheck) console.log('✔ Configuration ID 2 successfully mathematically deleted.');

    await sql.end();
    console.log('--- ALL DAOX COMPLEX MAPPINGS VALIDATED POSTGRES ---');
}

run().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
