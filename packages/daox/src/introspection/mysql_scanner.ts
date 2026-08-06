import mysql from 'mysql2/promise';
import { DatabaseSchema, TableSchema, IndexSchema } from './types.js';

interface MysqlTable extends mysql.RowDataPacket {
  TABLE_NAME: string;
}

interface MysqlColumn extends mysql.RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
  EXTRA: string | null;
  COLUMN_KEY: string | null;
}

interface MysqlIndex extends mysql.RowDataPacket {
  TABLE_NAME: string;
  INDEX_NAME: string;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
}

export async function scanMysql(url: string): Promise<DatabaseSchema> {
  const conn = await mysql.createConnection(url);
  
  const [tables] = await conn.query<MysqlTable[]>(`
    SELECT table_name as TABLE_NAME
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const [cols] = await conn.query<MysqlColumn[]>(`
    SELECT table_name as TABLE_NAME, column_name as COLUMN_NAME, data_type as DATA_TYPE, is_nullable as IS_NULLABLE, column_default as COLUMN_DEFAULT, extra as EXTRA, column_key as COLUMN_KEY
    FROM information_schema.columns 
    WHERE table_schema = DATABASE()
    ORDER BY table_name, ordinal_position
  `);

  const [indexes] = await conn.query<MysqlIndex[]>(`
    SELECT table_name as TABLE_NAME, index_name as INDEX_NAME, column_name as COLUMN_NAME, non_unique as NON_UNIQUE
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    ORDER BY table_name, index_name, seq_in_index
  `);
  
  await conn.end();

  const schema: DatabaseSchema = { tables: [] };
  
  const colsByTable = new Map<string, MysqlColumn[]>();
  for (const c of cols) {
    let arr = colsByTable.get(c.TABLE_NAME);
    if (!arr) colsByTable.set(c.TABLE_NAME, (arr = []));
    arr.push(c);
  }

  const idxsByTable = new Map<string, MysqlIndex[]>();
  for (const ix of indexes) {
    let arr = idxsByTable.get(ix.TABLE_NAME);
    if (!arr) idxsByTable.set(ix.TABLE_NAME, (arr = []));
    arr.push(ix);
  }

  for (const t of tables) {
    const tName = t.TABLE_NAME;
    const table: TableSchema = { name: tName, columns: [], primaryKeys: [], indexes: [] };
    
    const tCols = colsByTable.get(tName) || [];
    for (const c of tCols) {
      const cName = c.COLUMN_NAME;
      const extra = String(c.EXTRA || '').toLowerCase();
      table.columns.push({
        name: cName,
        sqlType: c.DATA_TYPE,
        typeLocal: '',
        isNullable: c.IS_NULLABLE === 'YES',
        hasDefault: c.COLUMN_DEFAULT !== null || extra.includes('auto_increment'),
        isAutoIncrement: extra.includes('auto_increment')
      });
    }

    const tIdxs = idxsByTable.get(tName) || [];
    const idxMap = new Map<string, IndexSchema>();
    for (const ix of tIdxs) {
      const idxName = ix.INDEX_NAME;
      if (idxName === 'PRIMARY') {
        table.primaryKeys.push(ix.COLUMN_NAME);
      } else {
        if (!idxMap.has(idxName)) {
          idxMap.set(idxName, {
            name: idxName,
            columns: [],
            isUnique: ix.NON_UNIQUE === 0
          });
        }
        idxMap.get(idxName)!.columns.push(ix.COLUMN_NAME);
      }
    }
    table.indexes = Array.from(idxMap.values());
    schema.tables.push(table);
  }
  
  return schema;
}
