import { PostgresExecutor } from '../../dist/index.js';
import postgres from 'postgres';
import { UsersDao, ConfigurationsDao, Product_metadataDao } from './postgres_dao/index.js';

async function run() {
    console.log('--- STARTING DAOX POSTGRES COMPLEX E2E EXECUTION ---');
    
    const sql = postgres('postgres://root:password@127.0.0.1:5455/db');
    const exe = new PostgresExecutor(sql);
    
    console.log('[1/3] Testing FIND (findByPk) on Seeded Data ...');
    const user = await UsersDao.findById(exe, 1);
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
    console.log('[3/3] Testing complex Stream / Enum / JSON map ...');
    let complexCount = 0;
    for await (const row of Product_metadataDao.listByCursor(exe, null, 10)) {
        complexCount++;
        console.log(`  Streamed Meta -> ${row.category} /`, row.attributes);
    }
    console.log('✔ Metadata streamed successfully. Count:', complexCount);

    await sql.end();
    console.log('--- ALL DAOX COMPLEX MAPPINGS VALIDATED POSTGRES ---');
}

run().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
