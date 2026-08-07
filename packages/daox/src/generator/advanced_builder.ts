import { TableSchema } from '../introspection/types.js';
import { escapeIdentifier } from './escape.js';

/**
 * Maximum parameter counts per dialect for insertBatch chunking (Tache 3.4).
 * Exceeding these limits would cause the prepared statement to fail or explode memory.
 */
const MAX_PARAMS: Record<string, number> = {
  postgres: 65535,
  mysql: 65535,
  sqlite: 999,
  oracle: 65535,
  mssql: 2100,
  sqlserver: 2100,
};

/**
 * Returns the parameter placeholder pattern for the given dialect.
 */
function paramPlaceholder(dialect: string, index: number): string {
  switch (dialect) {
    case 'postgres': return '$' + String(index);
    case 'oracle': return ':' + String(index);
    case 'mssql':
    case 'sqlserver': return '@p' + String(index);
    default: return '?';
  }
}

/**
 * Escapes a SQL identifier fragment so it can be safely embedded
 * inside a JavaScript double-quoted string literal.
 */
function jsStringEscape(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
}

/**
 * Resolves the PK TypeScript type from the DDL column information.
 */
function resolvePkType(table: TableSchema): string {
  if (table.primaryKeys.length !== 1) return 'unknown';
  const pkName = table.primaryKeys[0];
  const pkCol = table.columns.find(c => c.name === pkName);
  if (!pkCol) return 'unknown';
  return pkCol.typeLocal;
}

/**
 * AOT Compiler Module for high-performance operations (Stream / Bulk).
 * Generates:
 * - `listByCursor`: Keyset pagination via AsyncIterable (zero OFFSET).
 * - `insertBatch`: Bulk insert with automatic MAX_PARAMS chunking per dialect.
 *
 * @param dialect - The SQL dialect.
 * @param table - The introspected Table AST.
 * @returns Generated TypeScript methods as a string.
 */
export function buildAdvancedMethods(dialect: string, table: TableSchema): string {
  const safeTable = table.name.replace(/[^a-zA-Z0-9_$]/g, '_');
  const entity = safeTable.charAt(0).toUpperCase() + safeTable.slice(1);
  const escTable = jsStringEscape(escapeIdentifier(dialect, table.name));

  const pkName = table.primaryKeys.length === 1 ? table.primaryKeys[0] : '';
  const escPk = pkName ? jsStringEscape(escapeIdentifier(dialect, pkName)) : '';
  const pkType = resolvePkType(table);

  const isMssql = dialect === 'mssql' || dialect === 'sqlserver';
  const isOracle = dialect === 'oracle';

  // --- listByCursor ---
  let listByCursorMethod = '';
  if (pkName) {
    let firstPageSql: string;
    let nextPageSql: string;

    if (isMssql) {
      firstPageSql = jsStringEscape('SELECT TOP (' + paramPlaceholder(dialect, 1) + ') * FROM ' + escapeIdentifier(dialect, table.name) + ' ORDER BY ' + escapeIdentifier(dialect, pkName) + ' ASC');
      nextPageSql = jsStringEscape('SELECT TOP (' + paramPlaceholder(dialect, 1) + ') * FROM ' + escapeIdentifier(dialect, table.name) + ' WHERE ' + escapeIdentifier(dialect, pkName) + ' > ' + paramPlaceholder(dialect, 2) + ' ORDER BY ' + escapeIdentifier(dialect, pkName) + ' ASC');
    } else if (isOracle) {
      firstPageSql = jsStringEscape('SELECT * FROM ' + escapeIdentifier(dialect, table.name) + ' ORDER BY ' + escapeIdentifier(dialect, pkName) + ' ASC FETCH FIRST ' + paramPlaceholder(dialect, 1) + ' ROWS ONLY');
      nextPageSql = jsStringEscape('SELECT * FROM ' + escapeIdentifier(dialect, table.name) + ' WHERE ' + escapeIdentifier(dialect, pkName) + ' > ' + paramPlaceholder(dialect, 1) + ' ORDER BY ' + escapeIdentifier(dialect, pkName) + ' ASC FETCH FIRST ' + paramPlaceholder(dialect, 2) + ' ROWS ONLY');
    } else {
      const p1 = paramPlaceholder(dialect, 1);
      const p2 = paramPlaceholder(dialect, 2);
      firstPageSql = jsStringEscape('SELECT * FROM ' + escapeIdentifier(dialect, table.name) + ' ORDER BY ' + escapeIdentifier(dialect, pkName) + ' ASC LIMIT ' + p1);
      nextPageSql = jsStringEscape('SELECT * FROM ' + escapeIdentifier(dialect, table.name) + ' WHERE ' + escapeIdentifier(dialect, pkName) + ' > ' + p1 + ' ORDER BY ' + escapeIdentifier(dialect, pkName) + ' ASC LIMIT ' + p2);
    }

    if (isMssql) {
      listByCursorMethod = `
  static listByCursor(exe: GenericExecutor, lastCursor: ${pkType} | null | undefined, limit: number): AsyncIterable<${entity}Row> {
    if (lastCursor === null || lastCursor === undefined) {
      return exe.stream<${entity}Row>("${firstPageSql}", [limit]);
    } else {
      return exe.stream<${entity}Row>("${nextPageSql}", [limit, lastCursor]);
    }
  }`;
    } else {
      listByCursorMethod = `
  static listByCursor(exe: GenericExecutor, lastCursor: ${pkType} | null | undefined, limit: number): AsyncIterable<${entity}Row> {
    if (lastCursor === null || lastCursor === undefined) {
      return exe.stream<${entity}Row>("${firstPageSql}", [limit]);
    } else {
      return exe.stream<${entity}Row>("${nextPageSql}", [lastCursor, limit]);
    }
  }`;
    }
  }

  // --- insertBatch with MAX_PARAMS chunking (Tache 3.4) ---
  const maxParams = MAX_PARAMS[dialect] ?? 65535;

  const paramExpr = dialect === 'postgres'
    ? '`$${pos++}`'
    : dialect === 'oracle'
      ? '`:${pos++}`'
      : isMssql
        ? '`@p${pos++}`'
        : '"?"';

  let batchCoreLogic: string;
  if (isOracle) {
    batchCoreLogic = `
      const rowPhrases: string[] = [];
      const params: unknown[] = [];
      let pos = 1;
      for (const item of chunk) {
        const rowVals: string[] = [];
        for (const k of keys) {
          rowVals.push(${paramExpr});
          params.push((item as unknown as Record<string, unknown>)[k]);
        }
        rowPhrases.push("INTO ${escTable} (" + cols + ") VALUES (" + rowVals.join(", ") + ")");
      }
      const sql = "INSERT ALL " + rowPhrases.join(" ") + " SELECT 1 FROM DUAL";
      await exe.query<void>(sql, params);`;
  } else {
    batchCoreLogic = `
      const rowPhrases: string[] = [];
      const params: unknown[] = [];
      let pos = 1;
      for (const item of chunk) {
        const rowVals: string[] = [];
        for (const k of keys) {
          rowVals.push(${paramExpr});
          params.push((item as unknown as Record<string, unknown>)[k]);
        }
        rowPhrases.push("(" + rowVals.join(", ") + ")");
      }
      const sql = "INSERT INTO ${escTable} (" + cols + ") VALUES " + rowPhrases.join(", ");
      await exe.query<void>(sql, params);`;
  }

  const insertBatchMethod = `
  static async insertBatch(exe: GenericExecutor, items: ${entity}Insert[]): Promise<void> {
    if (items.length === 0) return;
    const keys = Object.keys(items[0] as unknown as Record<string, unknown>);
    const cols = keys.map(k => escapeIdentifier("${dialect}", k)).join(", ");
    const colCount = keys.length;
    const maxRows = Math.floor(${maxParams} / Math.max(colCount, 1));
    for (let offset = 0; offset < items.length; offset += maxRows) {
      const chunk = items.slice(offset, offset + maxRows);${batchCoreLogic}
    }
  }`;

  return [listByCursorMethod, insertBatchMethod].filter(Boolean).join('\n');
}
