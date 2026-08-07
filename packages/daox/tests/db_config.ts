import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * =========================================================================
 * DAOX INTEGRATION TESTS - DATABASE CONFIGURATION
 * =========================================================================
 * Centralized connection parameters for all integration tests.
 * Ensures consistent database targeting across runners, crawlers, and unit tests.
 */
export const DB_CONFIG = {
    // PostgreSQL Integration Database (via Docker)
    postgres: 'postgres://root:password@127.0.0.1:5455/db',
    
    // MySQL Local/Integration Database 
    mysql: 'mysql://phpmyadmin:@Test123@localhost/lightx_test',
    
    // MySQL Docker Database
    mysqlDocker: 'mysql://root:password@127.0.0.1:34567/db',
    
    // SQL Server Integration Database (via Docker)
    sqlserver: 'sqlserver://sa:Password123!@127.0.0.1:1433',
    
    // Oracle Integration Database (via Docker)
    oracle: 'oracle://SYSTEM:password@127.0.0.1:1521/FREEPDB1',
    
    // SQLite Playground Local Database (Absolute Path resolution via __dirname)
    sqlitePlaygroundPath: path.resolve(__dirname, 'integration/playground.db')
};
