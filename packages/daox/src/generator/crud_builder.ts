import { TableSchema } from '../introspection/types.js';
import { escapeIdentifier } from './escape.js';

/**
 * Foundational AOT Compiler Module for standard Database Operations (CRUD).
 * Generates computationally isolated TypeScript functions tailored accurately to the Database topology.
 * Adheres strictly to the YAGNI principle - omitting updates/deletions if Primary Keys are missing.
 * 
 * @param dialect The underlying specific SQL architecture (e.g. 'postgres', 'mysql', 'mssql').
 * @param table The introspected Table AST array.
 * @returns {string} Highly optimal static classes mapped perfectly to the SQL boundaries.
 */
export function buildCrudMethods(dialect: string, table: TableSchema): string {
  const safeTable = table.name.replace(/[^a-zA-Z0-9_$]/g, '_');
  const entity = safeTable.charAt(0).toUpperCase() + safeTable.slice(1);
  const escTable = escapeIdentifier(dialect, table.name).replace(/`/g, '\\\\`');
  
  const pChar = (iStr: string) => {
    if (dialect === 'postgres') return "\`$" + iStr + "\`";
    if (dialect === 'oracle') return "\`:" + iStr + "\`";
    if (dialect === 'mssql' || dialect === 'sqlserver') return "\`@p" + iStr + "\`";
    return "\`?\`";
  };
  
  const pkName = table.primaryKeys.length === 1 ? table.primaryKeys[0] : null;
  const PkTitle = pkName ? (pkName.charAt(0).toUpperCase() + pkName.slice(1)) : 'Pk';
  
  let returningClause = '';
  let outputClause = '';
  if (dialect === 'postgres' || dialect === 'sqlite') returningClause = ' RETURNING *';
  if (dialect === 'mssql' || dialect === 'sqlserver') outputClause = ' OUTPUT INSERTED.*';
  
  const insertMethod = `
  static async insert(exe: GenericExecutor, data: ${entity}Insert): Promise<${entity}Row> {
    const keys = Object.keys(data);
    let sql = '';
    let params: unknown[] = [];
    if (keys.length === 0) {
      ${(dialect === 'mssql' || dialect === 'sqlserver' || dialect === 'mysql') 
        ? `sql = \`INSERT INTO ${escTable}${outputClause} DEFAULT VALUES\`;`
        : `sql = \`INSERT INTO ${escTable} DEFAULT VALUES${returningClause}\`;`
      }
      if ("${dialect}" === "mysql") {
        sql = \`INSERT INTO ${escTable} () VALUES ()\`;
      }
    } else {
      const cols = keys.map(k => escapeIdentifier("${dialect}", k)).join(', ');
      const vals = keys.map((_, i) => ${pChar('${i + 1}')}).join(', ');
      sql = \`INSERT INTO ${escTable} (\${cols})${outputClause} VALUES (\${vals})${returningClause}\`;
      params = Object.values(data);
    }
    const rows = await exe.query<${entity}Row>(sql, params);
    return rows[0] as ${entity}Row;
  }`;

  const escPk = pkName ? escapeIdentifier(dialect, pkName).replace(/`/g, '\\\\`') : '';

  const findMethod = pkName ? `
  static async findBy${PkTitle}(exe: GenericExecutor, pk: any): Promise<${entity}Row | null> {
    const sql = \`SELECT * FROM ${escTable} WHERE ${escPk} = ${pChar('1').replace(/`/g, '')} ${(dialect === 'oracle' || dialect === 'mssql' || dialect === 'sqlserver') ? '' : 'LIMIT 1'}\`;
    const rows = await exe.query<${entity}Row>(sql, [pk]);
    return rows.length > 0 ? rows[0] : null;
  }` : '';

  const updateMethod = pkName ? `
  static async updatePartialBy${PkTitle}(exe: GenericExecutor, pk: any, patch: ${entity}Patch): Promise<void> {
    const keys = Object.keys(patch);
    if (keys.length === 0) return;
    const sets = keys.map((k, i) => \`\${escapeIdentifier("${dialect}", k)} = \${${pChar('${i + 1}')}.replace(/\\\`/g, '')}\`).join(', ');
    const sql = \`UPDATE ${escTable} SET \${sets} WHERE ${escPk} = \${${pChar('${keys.length + 1}')}.replace(/\\\`/g, '')}\`;
    await exe.query<void>(sql, [...Object.values(patch), pk]);
  }` : '';

  const deleteMethod = pkName ? `
  static async deleteBy${PkTitle}(exe: GenericExecutor, pk: any): Promise<void> {
    const sql = \`DELETE FROM ${escTable} WHERE ${escPk} = ${pChar('1').replace(/`/g, '')}\`;
    await exe.query<void>(sql, [pk]);
  }` : '';

  let indexMethods = '';
  // Avoid duplicating Primary Key as an index
  const validIndexes = (table.indexes || []).filter(idx => 
     !(idx.columns.length === 1 && idx.columns[0] === pkName)
  );

  for (const idx of validIndexes) {
    const colsTitle = idx.columns.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('And');
    const colsParamsTs = idx.columns.map(c => `${c}: any`).join(', ');
    const colsVals = idx.columns.map(c => c).join(', ');
    
    // Generate the raw where clause mapping strings: e.g. `"email" = $1 AND "status" = $2`
    const whereClause = idx.columns.map((c, i) => {
      const escC = escapeIdentifier(dialect, c).replace(/`/g, '\\\\`');
      const paramP = pChar(String(i + 1)).replace(/`/g, '');
      return `${escC} = ${paramP}`;
    }).join(' AND ');

    if (idx.isUnique) {
      indexMethods += `
  static async findBy${colsTitle}(exe: GenericExecutor, ${colsParamsTs}): Promise<${entity}Row | null> {
    const sql = \`SELECT * FROM ${escTable} WHERE ${whereClause} ${(dialect === 'oracle' || dialect === 'mssql' || dialect === 'sqlserver') ? '' : 'LIMIT 1'}\`;
    const rows = await exe.query<${entity}Row>(sql, [${colsVals}]);
    return rows.length > 0 ? rows[0] : null;
  }\n`;
    } else {
      indexMethods += `
  static async findAllBy${colsTitle}(exe: GenericExecutor, ${colsParamsTs}): Promise<${entity}Row[]> {
    const sql = \`SELECT * FROM ${escTable} WHERE ${whereClause}\`;
    const rows = await exe.query<${entity}Row>(sql, [${colsVals}]);
    return rows;
  }\n`;
    }
  }

  return [insertMethod, findMethod, updateMethod, deleteMethod, indexMethods].filter(Boolean).join('\n');
}
