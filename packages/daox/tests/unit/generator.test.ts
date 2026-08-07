/**
 * @file generator.test.ts
 * @description Unit tests for the AOT (Ahead-Of-Time) code generator module.
 * Validates the correct code generation for DAOs without requiring a live database,
 * promoting zero-overhead architecture goals.
 */
import { describe, it, expect } from '@jest/globals';
import { mapSqlTypeToTs } from '../../src/generator/type_mapper.js';

describe('TS Code Generator (AOT)', () => {
    describe('TypeMapper', () => {
        it('should correctly map SQL integer types to TypeScript number', () => {
            expect(mapSqlTypeToTs('sqlite', 'INTEGER')).toBe('number');
            expect(mapSqlTypeToTs('postgres', 'INT')).toBe('number');
        });

        it('should correctly map SQL string types to TypeScript string', () => {
            expect(mapSqlTypeToTs('mysql', 'VARCHAR')).toBe('string');
            expect(mapSqlTypeToTs('sqlite', 'TEXT')).toBe('string');
        });
        
        it('should throw error for unknown types to avoid runtime unpredictable states', () => {
            expect(() => mapSqlTypeToTs('sqlite', 'UNKNOWN_TYPE')).toThrow('SECURITY: Unsupported SQL Type <UNKNOWN_TYPE>');
        });
    });

    describe('Generator Engine YAGNI (Topology aware)', () => {
        const mockTableWithPk = {
            name: 'users',
            columns: [
                { name: 'id', sqlType: 'INTEGER', typeLocal: 'number', isNullable: false, hasDefault: true, isAutoIncrement: true },
                { name: 'email', sqlType: 'TEXT', typeLocal: 'string', isNullable: false, hasDefault: false, isAutoIncrement: false }
            ],
            primaryKeys: ['id'],
            indexes: []
        };

        const mockTableWithoutPk = {
            name: 'logs',
            columns: [
                { name: 'message', sqlType: 'TEXT', typeLocal: 'string', isNullable: false, hasDefault: false, isAutoIncrement: false },
                { name: 'timestamp', sqlType: 'INTEGER', typeLocal: 'number', isNullable: false, hasDefault: false, isAutoIncrement: false }
            ],
            primaryKeys: [],
            indexes: []
        };

        it('should ALWAYS generate base global methods (insert, count, insertBatch) even without PK', async () => {
            const { buildCrudMethods } = await import('../../src/generator/crud_builder.js');
            const { buildAdvancedMethods } = await import('../../src/generator/advanced_builder.js');
            const crudWithoutPk = buildCrudMethods('sqlite', mockTableWithoutPk);
            const advWithoutPk = buildAdvancedMethods('sqlite', mockTableWithoutPk);
            
            expect(crudWithoutPk).toContain('insert(');
            expect(crudWithoutPk).toContain('count(');
            expect(advWithoutPk).toContain('insertBatch(');
        });

        it('should generate findById YAGNI method ONLY if PK exists', async () => {
            const { buildCrudMethods } = await import('../../src/generator/crud_builder.js');
            const crudWithPk = buildCrudMethods('sqlite', mockTableWithPk);
            const crudWithoutPk = buildCrudMethods('sqlite', mockTableWithoutPk);
            
            expect(crudWithPk).toContain('findById(exe: GenericExecutor, pk: number)');
            expect(crudWithoutPk).not.toContain('findById(');
        });

        it('should generate existsById YAGNI method ONLY if PK exists', async () => {
            const { buildCrudMethods } = await import('../../src/generator/crud_builder.js');
            const crudWithPk = buildCrudMethods('sqlite', mockTableWithPk);
            const crudWithoutPk = buildCrudMethods('sqlite', mockTableWithoutPk);
            
            expect(crudWithPk).toContain('existsById(exe: GenericExecutor, pk: number)');
            expect(crudWithoutPk).not.toContain('existsById(');
        });

        it('should generate updateById YAGNI method ONLY if PK exists', async () => {
            const { buildCrudMethods } = await import('../../src/generator/crud_builder.js');
            const crudWithPk = buildCrudMethods('sqlite', mockTableWithPk);
            const crudWithoutPk = buildCrudMethods('sqlite', mockTableWithoutPk);
            
            expect(crudWithPk).toContain('updateById(exe: GenericExecutor, pk: number');
            expect(crudWithoutPk).not.toContain('updateById(');
        });

        it('should generate deleteById YAGNI method ONLY if PK exists', async () => {
            const { buildCrudMethods } = await import('../../src/generator/crud_builder.js');
            const crudWithPk = buildCrudMethods('sqlite', mockTableWithPk);
            const crudWithoutPk = buildCrudMethods('sqlite', mockTableWithoutPk);
            
            expect(crudWithPk).toContain('deleteById(exe: GenericExecutor, pk: number)');
            expect(crudWithoutPk).not.toContain('deleteById(');
        });

        it('should generate listByCursor & listByOffset YAGNI methods ONLY if PK exists', async () => {
            const { buildAdvancedMethods } = await import('../../src/generator/advanced_builder.js');
            const advWithPk = buildAdvancedMethods('sqlite', mockTableWithPk);
            const advWithoutPk = buildAdvancedMethods('sqlite', mockTableWithoutPk);
            
            expect(advWithPk).toContain('listByCursor(');
            expect(advWithPk).toContain('listByOffset(');
            expect(advWithoutPk).not.toContain('listByCursor(');
            expect(advWithoutPk).not.toContain('listByOffset(');
        });
        
        it('should generate Index-dependent methods (findAllBy..., findBy...) based on index uniqueness', async () => {
            const { buildCrudMethods } = await import('../../src/generator/crud_builder.js');
            const mockTableWithIndex = {
                name: 'accounts',
                columns: [
                    { name: 'email', sqlType: 'TEXT', typeLocal: 'string', isNullable: false, hasDefault: false, isAutoIncrement: false },
                    { name: 'status', sqlType: 'TEXT', typeLocal: 'string', isNullable: false, hasDefault: false, isAutoIncrement: false }
                ],
                primaryKeys: [],
                indexes: [
                    { name: 'idx_email', columns: ['email'], isUnique: true },
                    { name: 'idx_status', columns: ['status'], isUnique: false }
                ]
            };
            
            const crudWithIndex = buildCrudMethods('sqlite', mockTableWithIndex);
            
            // Unique index -> Singular 'findBy'
            expect(crudWithIndex).toContain('findByEmail(exe: GenericExecutor, email: string)');
            // Non-unique index -> Plural 'findAllBy'
            expect(crudWithIndex).toContain('findAllByStatus(exe: GenericExecutor, status: string)');
        });
    });

    describe('Overrides Weaver (AOT AST Injection)', () => {
        it('should successfully weave valid method overrides and new extensions', async () => {
            const fs = await import('node:fs');
            const path = await import('node:path');
            const { weaveOverride } = await import('../../src/generator/weaver.js');
            
            const overridesDir = path.join(process.cwd(), 'src', 'dao_overrides');
            if (!fs.existsSync(overridesDir)) fs.mkdirSync(overridesDir, { recursive: true });
            
            const generatedAst = `export class Mock_weaver_testDao {
                static async count(exe: GenericExecutor): Promise<number> {
                    return 0;
                }
            }`;
            
            const validOverride = `export class Mock_weaver_testDao {
                static async count(exe: GenericExecutor): Promise<number> {
                    return 42;
                }
                static async customMethod(a: string): Promise<void> {}
            }`;
            
            const testPath = path.join(overridesDir, 'mock_weaver_test.dao.ts');
            fs.writeFileSync(testPath, validOverride);
            
            try {
                const woven = weaveOverride('mock_weaver_test', 'Mock_weaver_test', generatedAst);
                expect(woven).toContain('return 42;');
                expect(woven).toContain('customMethod(a: string)');
                expect(woven).not.toContain('return 0;');
            } finally {
                fs.unlinkSync(testPath);
            }
        });

        it('should throw an absolute Error when an override signature mismatches', async () => {
            const fs = await import('node:fs');
            const path = await import('node:path');
            const { weaveOverride } = await import('../../src/generator/weaver.js');
            
            const overridesDir = path.join(process.cwd(), 'src', 'dao_overrides');
            if (!fs.existsSync(overridesDir)) fs.mkdirSync(overridesDir, { recursive: true });
            
            const generatedAst = `export class Mock_weaver_failDao {
                static async count(exe: GenericExecutor): Promise<number> { return 0; }
            }`;
            
            const invalidOverride = `export class Mock_weaver_failDao {
                static async count(exe: GenericExecutor, illegalArg: string): Promise<number> { return 42; }
            }`;
            
            const testPath = path.join(overridesDir, 'mock_weaver_fail.dao.ts');
            fs.writeFileSync(testPath, invalidOverride);
            
            try {
                expect(() => weaveOverride('mock_weaver_fail', 'Mock_weaver_fail', generatedAst))
                   .toThrow(/Signature mismatch for method 'count'/);
            } finally {
                fs.unlinkSync(testPath);
            }
        });
    });
});
