import Database from 'better-sqlite3';
import { DatabaseSchema, TableSchema } from './types.js';

interface SqliteTable {
  name: string;
}

interface SqliteColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface SqliteIndexList {
  name: string;
  unique: number;
  origin: string;
}

interface SqliteIndexInfo {
  name: string;
}

export async function scanSqlite(filePath: string): Promise<DatabaseSchema> {
  const dbPath = filePath.replace(/^sqlite:\/\//, '');
  const db = new Database(dbPath, { readonly: true });
  const schema: DatabaseSchema = { tables: [] };
  
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as SqliteTable[];
  
  for (const t of tables) {
    const table: TableSchema = { name: t.name, columns: [], primaryKeys: [], indexes: [] };
    
    const columnsInfo = db.prepare(`PRAGMA table_info("${t.name}")`).all() as SqliteColumn[];
    for (const c of columnsInfo) {
      const isAutoInc = c.pk === 1 && c.type.toLowerCase() === 'integer';
      table.columns.push({
        name: c.name,
        sqlType: c.type.toLowerCase(),
        typeLocal: '',
        isNullable: c.notnull === 0,
        hasDefault: c.dflt_value !== null || isAutoInc,
        isAutoIncrement: isAutoInc
      });
    }

    const pkCols = columnsInfo.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk);
    table.primaryKeys = pkCols.map(c => c.name);
    
    const index_list = db.prepare(`PRAGMA index_list("${t.name}")`).all() as SqliteIndexList[];
    for (const idx of index_list) {
      if (idx.origin === 'pk') continue;
      const idxInfo = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as SqliteIndexInfo[];
      table.indexes.push({
        name: idx.name,
        isUnique: idx.unique === 1,
        columns: idxInfo.map((i) => i.name)
      });
    }
    
    schema.tables.push(table);
  }
  
  db.close();
  return schema;
}
