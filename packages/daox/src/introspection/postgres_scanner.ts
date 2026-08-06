import postgres from 'postgres';
import { DatabaseSchema, TableSchema, IndexSchema } from './types.js';

interface PgTable {
  oid: number;
  name: string;
}

interface PgColumn {
  table_oid: number;
  name: string;
  sql_type: string;
  is_nullable: boolean;
  has_default: boolean;
  default_val: string | null;
}

interface PgPrimaryKey {
  table_oid: number;
  column_name: string;
}

interface PgIndex {
  table_oid: number;
  index_name: string;
  column_name: string;
  is_unique: boolean;
}

export async function scanPostgres(url: string): Promise<DatabaseSchema> {
  const sql = postgres(url, { max: 1 });

  const tablesResult = await sql<PgTable[]>`
    SELECT c.oid, c.relname as name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN information_schema.tables i ON i.table_name = c.relname AND i.table_schema = n.nspname
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND i.table_type = 'BASE TABLE'
    ORDER BY c.relname
  `;

  if (tablesResult.length === 0) {
    await sql.end();
    return { tables: [] };
  }

  const tableOids = tablesResult.map(t => t.oid);

  const columnsResult = await sql<PgColumn[]>`
    SELECT 
      a.attrelid as table_oid,
      a.attname as name,
      t.typname as sql_type,
      not a.attnotnull as is_nullable,
      a.atthasdef as has_default,
      pg_get_expr(ad.adbin, ad.adrelid) as default_val
    FROM pg_attribute a
    JOIN pg_type t ON a.atttypid = t.oid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attnum > 0 AND a.attisdropped = false AND a.attrelid = ANY(${tableOids}::oid[])
    ORDER BY a.attrelid, a.attnum
  `;

  const pkeysResult = await sql<PgPrimaryKey[]>`
    SELECT 
      c.conrelid as table_oid,
      a.attname as column_name
    FROM pg_constraint c
    CROSS JOIN UNNEST(c.conkey) WITH ORDINALITY as k(attnum, pos)
    JOIN pg_attribute a ON a.attnum = k.attnum AND a.attrelid = c.conrelid
    WHERE c.contype = 'p' AND c.conrelid = ANY(${tableOids}::oid[])
    ORDER BY c.conrelid, k.pos
  `;

  const indexesResult = await sql<PgIndex[]>`
    SELECT 
      ix.indrelid as table_oid,
      c.relname as index_name,
      a.attname as column_name,
      ix.indisunique as is_unique
    FROM pg_index ix
    CROSS JOIN UNNEST(ix.indkey) WITH ORDINALITY as k(attnum, pos)
    JOIN pg_class c ON c.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
    WHERE ix.indisprimary = false 
      AND ix.indrelid = ANY(${tableOids}::oid[])
      AND k.pos <= ix.indnkeyatts
    ORDER BY ix.indrelid, c.relname, k.pos
  `;

  await sql.end();

  const schema: DatabaseSchema = { tables: [] };

  const colsByTable = new Map<number, PgColumn[]>();
  for (const c of columnsResult) {
    let arr = colsByTable.get(c.table_oid);
    if (!arr) colsByTable.set(c.table_oid, (arr = []));
    arr.push(c);
  }

  const pksByTable = new Map<number, PgPrimaryKey[]>();
  for (const pk of pkeysResult) {
    let arr = pksByTable.get(pk.table_oid);
    if (!arr) pksByTable.set(pk.table_oid, (arr = []));
    arr.push(pk);
  }

  const idxsByTable = new Map<number, PgIndex[]>();
  for (const ix of indexesResult) {
    let arr = idxsByTable.get(ix.table_oid);
    if (!arr) idxsByTable.set(ix.table_oid, (arr = []));
    arr.push(ix);
  }

  for (const t of tablesResult) {
    const tableOid = t.oid;
    const table: TableSchema = {
      name: t.name,
      columns: [],
      primaryKeys: [],
      indexes: []
    };

    const tCols = colsByTable.get(tableOid) || [];
    for (const c of tCols) {
      const defaultStr = c.default_val || '';
      const isAutoIncrement = defaultStr.includes('nextval(');
      table.columns.push({
        name: c.name,
        sqlType: c.sql_type,
        typeLocal: '',
        isNullable: c.is_nullable,
        hasDefault: c.has_default || isAutoIncrement,
        isAutoIncrement
      });
    }

    const tPks = pksByTable.get(tableOid) || [];
    for (const pk of tPks) {
      table.primaryKeys.push(pk.column_name);
    }

    const tIdxs = idxsByTable.get(tableOid) || [];
    const indexMap = new Map<string, IndexSchema>();
    for (const ix of tIdxs) {
      if (!indexMap.has(ix.index_name)) {
        indexMap.set(ix.index_name, { name: ix.index_name, columns: [], isUnique: ix.is_unique });
      }
      indexMap.get(ix.index_name)!.columns.push(ix.column_name);
    }
    table.indexes = Array.from(indexMap.values());

    schema.tables.push(table);
  }

  return schema;
}
