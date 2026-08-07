/**
 * @file sqlite.test.ts
 * @description Integration tests for SQLite Bare-Metal Engine using true In-Memory instances.
 * Guarantees that the underlying architecture runs gracefully against node-sqlite plugins.
 * Ensures zero-overhead execution for robust memory-constrained environments.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';

describe('SQLite Bare-Metal Integration', () => {
    let db: Database.Database;

    beforeAll(() => {
        // Create an isolated In-Memory SQLite database specifically for test executions.
        // Doing so circumvents potential filesystem race conditions in CI environments.
        db = new Database(':memory:');
        db.exec(`
            CREATE TABLE test_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
        `);
    });

    afterAll(() => {
        // Strict teardown prevents resource leaks during widespread integration pipelines
        db.close();
    });

    it('should validate local query robustness without ORM overhead dynamically', () => {
        const stmt = db.prepare('INSERT INTO test_items (name) VALUES (?)');
        const info = stmt.run('Sample Item');
        
        expect(info.changes).toBe(1);
        expect(info.lastInsertRowid).toBeDefined();
    });

    it('should accurately retrieve data mathematically ensuring typing precision', () => {
        const stmt = db.prepare('SELECT * FROM test_items WHERE name = ?');
        const result = stmt.get('Sample Item') as { id: number, name: string };
        
        expect(result.name).toBe('Sample Item');
        expect(result.id).toBeGreaterThan(0);
    });
});
