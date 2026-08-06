import oracledb from 'oracledb';
import { DatabaseSchema, TableSchema, IndexSchema } from './types.js';

type OracleTable = [string];
type OracleColumn = [string, string, string, string, string | null, string];
type OraclePk = [string, string];
type OracleIndex = [string, string, string, string];

export async function scanOracle(url: string): Promise<DatabaseSchema> {
  const conn = await oracledb.getConnection(url);

  const tablesResult = await conn.execute<OracleTable>(`
    SELECT table_name 
    FROM all_tables
    WHERE owner = sys_context('userenv','current_user')
  `);

  const colsResult = await conn.execute<OracleColumn>(`
    SELECT table_name, column_name, data_type, nullable, data_default, identity_column
    FROM all_tab_columns
    WHERE owner = sys_context('userenv','current_user')
  `);

  const pksResult = await conn.execute<OraclePk>(`
    SELECT cons.table_name, cols.column_name
    FROM all_constraints cons 
    JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
    WHERE cons.constraint_type = 'P' AND cons.owner = sys_context('userenv','current_user')
    ORDER BY cons.table_name, cols.position
  `);

  const idxsResult = await conn.execute<OracleIndex>(`
    SELECT i.table_name, i.index_name, ic.column_name, i.uniqueness
    FROM all_indexes i
    JOIN all_ind_columns ic ON i.index_name = ic.index_name AND i.owner = ic.index_owner
    WHERE i.index_type != 'LOB' 
      AND i.owner = sys_context('userenv','current_user')
      AND NOT EXISTS (
        SELECT 1 FROM all_constraints c 
        WHERE c.index_name = i.index_name AND c.owner = i.owner AND c.constraint_type = 'P'
      )
    ORDER BY i.table_name, i.index_name, ic.column_position
  `);
  
  await conn.close();

  const schema: DatabaseSchema = { tables: [] };
  const getRows = <T>(res: oracledb.Result<T>): T[] => res.rows || [];

  const cRows = getRows(colsResult);
  const pkRows = getRows(pksResult);
  const ixRows = getRows(idxsResult);

  const colsByTable = new Map<string, OracleColumn[]>();
  for (const r of cRows) {
    let arr = colsByTable.get(r[0]);
    if (!arr) colsByTable.set(r[0], (arr = []));
    arr.push(r);
  }

  const pksByTable = new Map<string, OraclePk[]>();
  for (const r of pkRows) {
    let arr = pksByTable.get(r[0]);
    if (!arr) pksByTable.set(r[0], (arr = []));
    arr.push(r);
  }

  const idxsByTable = new Map<string, OracleIndex[]>();
  for (const r of ixRows) {
    let arr = idxsByTable.get(r[0]);
    if (!arr) idxsByTable.set(r[0], (arr = []));
    arr.push(r);
  }

  for (const tRow of getRows(tablesResult)) {
    const rawTName = tRow[0];
    const tName = String(rawTName).toLowerCase();
    const table: TableSchema = { name: tName, columns: [], primaryKeys: [], indexes: [] };

    const tCols = colsByTable.get(rawTName) || [];
    for (const cRow of tCols) {
      const cName = String(cRow[1]).toLowerCase();
      table.columns.push({
        name: cName,
        sqlType: String(cRow[2]),
        typeLocal: '',
        isNullable: cRow[3] === 'Y',
        hasDefault: cRow[4] !== null || cRow[5] === 'YES',
        isAutoIncrement: cRow[5] === 'YES'
      });
    }

    const tPks = pksByTable.get(rawTName) || [];
    for (const pkRow of tPks) {
      table.primaryKeys.push(String(pkRow[1]).toLowerCase());
    }

    const tIdxs = idxsByTable.get(rawTName) || [];
    const idxMap = new Map<string, IndexSchema>();
    for (const ixRow of tIdxs) {
      const idxName = String(ixRow[1]).toLowerCase();
      if (!idxMap.has(idxName)) {
        idxMap.set(idxName, {
          name: idxName,
          columns: [],
          isUnique: ixRow[3] === 'UNIQUE'
        });
      }
      idxMap.get(idxName)!.columns.push(String(ixRow[2]).toLowerCase());
    }
    table.indexes = Array.from(idxMap.values());
    schema.tables.push(table);
  }

  return schema;
}
