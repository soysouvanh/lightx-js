import { escapeIdentifier } from './escape.js';
export function buildAdvancedMethods(dialect, table) {
    const safeTable = table.name.replace(/[^a-zA-Z0-9_$]/g, '_');
    const entity = safeTable.charAt(0).toUpperCase() + safeTable.slice(1);
    const escTable = escapeIdentifier(dialect, table.name).replace(/`/g, '\\`');
    const pkName = table.primaryKeys.length === 1 ? table.primaryKeys[0] : '';
    const escPk = pkName ? escapeIdentifier(dialect, pkName).replace(/`/g, '\\`') : '';
    const pChar = (iStr) => {
        if (dialect === 'postgres')
            return "\`$" + iStr + "\`";
        if (dialect === 'oracle')
            return "\`:" + iStr + "\`";
        if (dialect === 'mssql' || dialect === 'sqlserver')
            return "\`@p" + iStr + "\`";
        return "\`?\`";
    };
    const sel1 = (dialect === 'mssql' || dialect === 'sqlserver') ? `SELECT TOP (@p1) * FROM ${escTable}` : `SELECT * FROM ${escTable}`;
    const sel2 = (dialect === 'mssql' || dialect === 'sqlserver') ? `SELECT TOP (@p1) * FROM ${escTable}` : `SELECT * FROM ${escTable}`;
    const end1 = (dialect === 'mssql' || dialect === 'sqlserver') ? '' : (dialect === 'oracle' ? `FETCH FIRST :1 ROWS ONLY` : `LIMIT ${dialect === 'postgres' ? '$1' : '?'}`);
    const end2 = (dialect === 'mssql' || dialect === 'sqlserver') ? '' : (dialect === 'oracle' ? `FETCH FIRST :2 ROWS ONLY` : `LIMIT ${dialect === 'postgres' ? '$2' : '?'}`);
    const pWhere = dialect === 'postgres' ? '$1' : dialect === 'oracle' ? ':1' : (dialect === 'mssql' || dialect === 'sqlserver') ? '@p2' : '?';
    const listByCursorMethod = pkName ? `
  static listByCursor(exe: GenericExecutor, lastCursor: any, limit: number): AsyncIterable<${entity}Row> {
    if (lastCursor === null || lastCursor === undefined) {
      const sql = \`${sel1} ORDER BY ${escPk} ASC ${end1}\`.trim();
      return exe.stream<${entity}Row>(sql, [limit]);
    } else {
      const sql = \`${sel2} WHERE ${escPk} > ${pWhere} ORDER BY ${escPk} ASC ${end2}\`.trim();
      return exe.stream<${entity}Row>(sql, (dialect === 'mssql' || dialect === 'sqlserver') ? [limit, lastCursor] : [lastCursor, limit]);
    }
  }` : '';
    const insertBatchMethod = `
  static async insertBatch(exe: GenericExecutor, items: ${entity}Insert[]): Promise<void> {
    if (items.length === 0) return;
    const keys = Object.keys(items[0]);
    const cols = keys.map(k => escapeIdentifier("${dialect}", k)).join(', ');
    
    const params: any[] = [];
    const valuesPhrases: string[] = [];
    
    let pos = 1;
    for (const item of items) {
      const rowVals: string[] = [];
      for (const k of keys) {
        rowVals.push(${pChar('${pos++}')});
        params.push((item as any)[k]);
      }
      ${dialect === 'oracle'
        ? `valuesPhrases.push(\`INTO ${escTable} (\${cols}) VALUES (\${rowVals.join(', ')})\`);`
        : `valuesPhrases.push(\`(\${rowVals.join(', ')})\`);`}
    }
    
    ${dialect === 'oracle'
        ? `const sql = \`INSERT ALL \${valuesPhrases.join(' ')} SELECT 1 FROM DUAL\`;`
        : `const sql = \`INSERT INTO ${escTable} (\${cols}) VALUES \${valuesPhrases.join(', ')}\`;`}
    await exe.query<void>(sql, params);
  }`;
    return [listByCursorMethod, insertBatchMethod].filter(Boolean).join('\n');
}
