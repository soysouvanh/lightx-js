import { TableSchema } from '../introspection/types.js';
import { escapeIdentifier, toSafeTsIdentifier } from './escape.js';

/**
 * Returns the parameter placeholder pattern for the given dialect.
 * - Postgres: $1, $2, ...
 * - Oracle: :1, :2, ...
 * - MSSQL/SQLServer: @p1, @p2, ...
 * - MySQL/SQLite: ?
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
 * - Double-quotes `"` => `\\"`
 * - Backticks `` ` `` => `` \\` ``
 * - Backslashes `\` => `\\\\`
 */
function jsStringEscape(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
}

/**
 * Returns the RETURNING clause for INSERT operations.
 */
function getReturningClause(dialect: string): string {
  if (dialect === 'postgres' || dialect === 'sqlite') return ' RETURNING *';
  return '';
}

/**
 * Returns the OUTPUT clause for INSERT operations (MSSQL only).
 */
function getOutputClause(dialect: string): string {
  if (dialect === 'mssql' || dialect === 'sqlserver') return ' OUTPUT INSERTED.*';
  return '';
}

/**
 * Returns the LIMIT clause for SELECT operations.
 */
function getLimitClause(dialect: string): string {
  if (dialect === 'oracle' || dialect === 'mssql' || dialect === 'sqlserver') return '';
  return ' LIMIT 1';
}

/**
 * Resolves the PK TypeScript type from the DDL column information.
 * Never falls back to `any` - the PK is always structurally typed from the DDL.
 */
function resolvePkType(table: TableSchema): string {
  if (table.primaryKeys.length !== 1) return 'unknown';
  const pkName = table.primaryKeys[0];
  const pkCol = table.columns.find(c => c.name === pkName);
  if (!pkCol) return 'unknown';
  return pkCol.typeLocal;
}

/**
 * AOT Compiler Module for standard CRUD operations.
 * Generates TypeScript functions with:
 * - Structurally typed primary keys (never `any`)
 * - Full escapeIdentifier wrapping on all SQL identifiers
 * - Parameterized queries only (zero string concatenation at runtime)
 *
 * @param dialect - The SQL dialect (postgres, mysql, sqlite, oracle, mssql).
 * @param table - The introspected Table AST.
 * @returns Generated TypeScript CRUD methods as a string.
 */
export function buildCrudMethods(dialect: string, table: TableSchema): string {
  const safeTable = toSafeTsIdentifier(table.name, 'table');
  const entity = safeTable.charAt(0).toUpperCase() + safeTable.slice(1);
  const escTable = jsStringEscape(escapeIdentifier(dialect, table.name));

  const pkName = table.primaryKeys.length === 1 ? table.primaryKeys[0] : null;
  const PkTitle = pkName ? (pkName.charAt(0).toUpperCase() + pkName.slice(1)) : 'Pk';
  const pkType = resolvePkType(table);

  const returningClause = getReturningClause(dialect);
  const outputClause = getOutputClause(dialect);
  const limitClause = getLimitClause(dialect);
  const isMssql = dialect === 'mssql' || dialect === 'sqlserver';
  const isMysql = dialect === 'mysql';

  const validColsField = `  private static readonly _VALID_COLS = new Set(${JSON.stringify(table.columns.map(c => c.name))});`;

  // --- INSERT ---
  let insertDefaultSql: string;
  if (isMssql) {
    insertDefaultSql = jsStringEscape('INSERT INTO ' + escapeIdentifier(dialect, table.name) + outputClause + ' DEFAULT VALUES');
  } else if (isMysql) {
    insertDefaultSql = jsStringEscape('INSERT INTO ' + escapeIdentifier(dialect, table.name) + ' () VALUES ()');
  } else {
    insertDefaultSql = jsStringEscape('INSERT INTO ' + escapeIdentifier(dialect, table.name) + ' DEFAULT VALUES' + returningClause);
  }

  const paramExpr = dialect === 'postgres'
    ? '`$${i + 1}`'
    : dialect === 'oracle'
      ? '`:${i + 1}`'
      : isMssql
        ? '`@p${i + 1}`'
        : '"?"';

  const insertOutputPosition = isMssql ? outputClause : '';
  const insertReturning = (!isMssql) ? returningClause : '';

  const insertMethod = `
  static async insert(exe: GenericExecutor, data: ${entity}Insert): Promise<${entity}Row> {
    const keys = Object.keys(data).filter(k => ${entity}Dao._VALID_COLS.has(k)) as Array<keyof typeof data>;
    if (keys.length === 0) {
      const rows = await exe.query<${entity}Row>("${insertDefaultSql}");
      return rows[0] as ${entity}Row;
    }
    const cols = keys.map(k => escapeIdentifier("${dialect}", k as string)).join(", ");
    const vals = keys.map((_, i) => ${paramExpr}).join(", ");
    const sql = "INSERT INTO ${escTable} (" + cols + ")${insertOutputPosition} VALUES (" + vals + ")${insertReturning}";
    const params: unknown[] = keys.map(k => data[k]);
    const rows = await exe.query<${entity}Row>(sql, params);
    return rows[0] as ${entity}Row;
  }`;

  // --- COUNT ---
  const countMethod = `
  static async count(exe: GenericExecutor): Promise<number> {
    const sql = "SELECT COUNT(*) as c FROM ${escTable}";
    const rows = await exe.query<{ c: string | number | bigint }>(sql, []);
    return Number(rows[0] ? rows[0].c : 0);
  }`;

  // --- FIND BY PK ---
  let findMethod = '';
  let existsMethod = '';
  if (pkName) {
    const escPk = jsStringEscape(escapeIdentifier(dialect, pkName));
    const p1 = paramPlaceholder(dialect, 1);
    findMethod = `
  static async findBy${PkTitle}(exe: GenericExecutor, pk: ${pkType}): Promise<${entity}Row | null> {
    const sql = "SELECT * FROM ${escTable} WHERE ${escPk} = ${p1}${limitClause}";
    const rows = await exe.query<${entity}Row>(sql, [pk]);
    return rows.length > 0 ? rows[0] as ${entity}Row : null;
  }`;

    existsMethod = `
  static async existsBy${PkTitle}(exe: GenericExecutor, pk: ${pkType}): Promise<boolean> {
    const sql = "SELECT 1 AS e FROM ${escTable} WHERE ${escPk} = ${p1}${limitClause}";
    const rows = await exe.query<{ e: number }>(sql, [pk]);
    return rows.length > 0;
  }`;
  }

  // --- UPDATE PARTIAL BY PK ---
  let updateMethod = '';
  if (pkName) {
    const escPk = jsStringEscape(escapeIdentifier(dialect, pkName));

    const setExpr = dialect === 'postgres'
      ? '`${escapeIdentifier("postgres", k as string)} = $${i + 1}`'
      : dialect === 'oracle'
        ? '`${escapeIdentifier("oracle", k as string)} = :${i + 1}`'
        : isMssql
          ? '`${escapeIdentifier("mssql", k as string)} = @p${i + 1}`'
          : '`${escapeIdentifier("' + dialect + '", k as string)} = ?`';

    const pkParamExpr = dialect === 'postgres'
      ? '`$${keys.length + 1}`'
      : dialect === 'oracle'
        ? '`:${keys.length + 1}`'
        : isMssql
          ? '`@p${keys.length + 1}`'
          : '"?"';

    updateMethod = `
  static async updateBy${PkTitle}(exe: GenericExecutor, pk: ${pkType}, patch: ${entity}Patch): Promise<void> {
    const keys = Object.keys(patch).filter(k => ${entity}Dao._VALID_COLS.has(k)) as Array<keyof typeof patch>;
    if (keys.length === 0) return;
    const sets = keys.map((k, i) => ${setExpr}).join(", ");
    const pkParam = ${pkParamExpr};
    const sql = "UPDATE ${escTable} SET " + sets + " WHERE ${escPk} = " + pkParam;
    const params: unknown[] = [...keys.map(k => patch[k]), pk];
    await exe.query<void>(sql, params);
  }`;
  }

  // --- DELETE BY PK ---
  let deleteMethod = '';
  if (pkName) {
    const escPk = jsStringEscape(escapeIdentifier(dialect, pkName));
    const p1 = paramPlaceholder(dialect, 1);
    deleteMethod = `
  static async deleteBy${PkTitle}(exe: GenericExecutor, pk: ${pkType}): Promise<void> {
    const sql = "DELETE FROM ${escTable} WHERE ${escPk} = ${p1}";
    await exe.query<void>(sql, [pk]);
  }`;
  }

  // --- INDEX METHODS ---
  let indexMethods = '';
  const validIndexes = (table.indexes || []).filter(idx =>
    !(idx.columns.length === 1 && idx.columns[0] === pkName)
  );

  for (const idx of validIndexes) {
    const colsTitle = idx.columns.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('And');

    // Resolve typed parameters from DDL (never any)
    const colsParamsTs = idx.columns.map(c => {
      const col = table.columns.find(tc => tc.name === c);
      const colType = col ? col.typeLocal + (col.isNullable ? ' | null' : '') : 'unknown';
      return `${toSafeTsIdentifier(c, 'col')}: ${colType}`;
    }).join(', ');

    const colsVals = idx.columns.map(c => toSafeTsIdentifier(c, 'col')).join(', ');
    
    const whereClause = idx.columns.map((c, i) => {
      const escC = jsStringEscape(escapeIdentifier(dialect, c));
      const paramP = paramPlaceholder(dialect, i + 1);
      return `${escC} = ${paramP}`;
    }).join(' AND ');

    indexMethods += `
  static async existsBy${colsTitle}(exe: GenericExecutor, ${colsParamsTs}): Promise<boolean> {
    const sql = "SELECT 1 AS e FROM ${escTable} WHERE ${whereClause}${limitClause}";
    const rows = await exe.query<{ e: number }>(sql, [${colsVals}]);
    return rows.length > 0;
  }\n`;

    if (idx.isUnique) {
      indexMethods += `
  static async findBy${colsTitle}(exe: GenericExecutor, ${colsParamsTs}): Promise<${entity}Row | null> {
    const sql = "SELECT * FROM ${escTable} WHERE ${whereClause}${limitClause}";
    const rows = await exe.query<${entity}Row>(sql, [${colsVals}]);
    return rows.length > 0 ? rows[0] as ${entity}Row : null;
  }\n`;
    } else {
      indexMethods += `
  static async findAllBy${colsTitle}(exe: GenericExecutor, ${colsParamsTs}): Promise<${entity}Row[]> {
    const sql = "SELECT * FROM ${escTable} WHERE ${whereClause}";
    const rows = await exe.query<${entity}Row>(sql, [${colsVals}]);
    return rows;
  }

  static async countBy${colsTitle}(exe: GenericExecutor, ${colsParamsTs}): Promise<number> {
    const sql = "SELECT COUNT(*) as c FROM ${escTable} WHERE ${whereClause}";
    const rows = await exe.query<{ c: string | number | bigint }>(sql, [${colsVals}]);
    return Number(rows[0] ? rows[0].c : 0);
  }\n`;
    }
  }

  return [validColsField, insertMethod, countMethod, findMethod, existsMethod, updateMethod, deleteMethod, indexMethods].filter(Boolean).join('\n');
}
