import { describe, it, expect, jest } from '@jest/globals';
import { PostgresExecutor, SqliteExecutor, MysqlExecutor } from '../../src/runtime/drivers.js';

describe('GenericExecutor (Stateless Boundary)', () => {
    describe('Transaction Passthrough', () => {
        it('should natively pass BEGIN, COMMIT and ROLLBACK via PostgresExecutor without interception', async () => {
            const mockSql: any = {
                unsafe: jest.fn().mockResolvedValue([])
            };
            const exe = new PostgresExecutor(mockSql);
            
            await exe.query('BEGIN');
            expect(mockSql.unsafe).toHaveBeenCalledWith('BEGIN', undefined);

            await exe.query('COMMIT');
            expect(mockSql.unsafe).toHaveBeenCalledWith('COMMIT', undefined);
            
            await exe.query('ROLLBACK');
            expect(mockSql.unsafe).toHaveBeenCalledWith('ROLLBACK', undefined);
        });

        it('should correctly process synchronous transactional runs via SqliteExecutor', async () => {
            const mockDatabase: any = {
                prepare: jest.fn().mockReturnValue({
                    reader: false,
                    run: jest.fn()
                })
            };
            
            const exe = new SqliteExecutor(mockDatabase);
            
            await exe.query('BEGIN TRANSACTION;');
            expect(mockDatabase.prepare).toHaveBeenCalledWith('BEGIN TRANSACTION;');
            
            const runSpy = mockDatabase.prepare().run;
            expect(runSpy).toHaveBeenCalled();
        });

        it('should pass transactional state via MysqlExecutor', async () => {
            const mockConn: any = {
                execute: jest.fn().mockResolvedValue([[], []])
            };
            const exe = new MysqlExecutor(mockConn);
            
            await exe.query('START TRANSACTION');
            expect(mockConn.execute).toHaveBeenCalledWith('START TRANSACTION', []);
            
            await exe.query('COMMIT');
            expect(mockConn.execute).toHaveBeenCalledWith('COMMIT', []);
        });
    });
});
