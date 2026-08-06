import mssql from 'mssql';
export async function scanSqlServer(url) {
    const pool = await mssql.connect(url);
    const tables = await pool.request().query(`
    SELECT object_id, name 
    FROM sys.tables 
    WHERE is_ms_shipped = 0
    ORDER BY name
  `);
    const columns = await pool.request().query(`
    SELECT c.object_id, c.name, t.name as type_name, c.is_nullable, c.is_identity,
           object_definition(c.default_object_id) as default_val
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    JOIN sys.tables tbl ON tbl.object_id = c.object_id
    WHERE tbl.is_ms_shipped = 0
    ORDER BY c.object_id, c.column_id
  `);
    const indexes = await pool.request().query(`
    SELECT i.object_id, i.name, i.is_unique, i.is_primary_key, c.name as column_name
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    JOIN sys.tables tbl ON tbl.object_id = i.object_id
    WHERE i.type > 0 AND tbl.is_ms_shipped = 0 AND ic.is_included_column = 0
    ORDER BY i.object_id, i.index_id, ic.key_ordinal
  `);
    await pool.close();
    const schema = { tables: [] };
    const colsByTable = new Map();
    for (const c of columns.recordset) {
        let arr = colsByTable.get(c.object_id);
        if (!arr)
            colsByTable.set(c.object_id, (arr = []));
        arr.push(c);
    }
    const idxsByTable = new Map();
    for (const ix of indexes.recordset) {
        let arr = idxsByTable.get(ix.object_id);
        if (!arr)
            idxsByTable.set(ix.object_id, (arr = []));
        arr.push(ix);
    }
    for (const t of tables.recordset) {
        const table = { name: t.name, columns: [], primaryKeys: [], indexes: [] };
        const tCols = colsByTable.get(t.object_id) || [];
        for (const c of tCols) {
            table.columns.push({
                name: c.name,
                sqlType: c.type_name,
                typeLocal: '',
                isNullable: c.is_nullable,
                hasDefault: c.default_val !== null || c.is_identity,
                isAutoIncrement: c.is_identity
            });
        }
        const idxMap = new Map();
        const tIdxs = idxsByTable.get(t.object_id) || [];
        for (const ix of tIdxs) {
            if (ix.is_primary_key) {
                table.primaryKeys.push(ix.column_name);
            }
            else {
                if (!idxMap.has(ix.name)) {
                    idxMap.set(ix.name, {
                        name: ix.name,
                        columns: [],
                        isUnique: ix.is_unique
                    });
                }
                idxMap.get(ix.name).columns.push(ix.column_name);
            }
        }
        table.indexes = Array.from(idxMap.values());
        schema.tables.push(table);
    }
    return schema;
}
