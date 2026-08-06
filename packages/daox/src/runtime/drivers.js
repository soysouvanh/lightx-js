export class PostgresExecutor {
    sql;
    constructor(sql) {
        this.sql = sql;
    }
    async query(sql, params) {
        return (await this.sql.unsafe(sql, params));
    }
    async *stream(sql, params) {
        const cursor = this.sql.unsafe(sql, params).cursor(100);
        for await (const chunk of cursor) {
            for (const row of chunk) {
                yield row;
            }
        }
    }
}
export class MysqlExecutor {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async query(sql, params) {
        const [rows] = await this.conn.execute(sql, (params || []));
        return rows;
    }
    async *stream(sql, params) {
        const stream = this.conn.connection.execute(sql, params || []).stream();
        for await (const row of stream) {
            yield row;
        }
    }
}
export class SqliteExecutor {
    db;
    constructor(db) {
        this.db = db;
    }
    async query(sql, params) {
        const stmt = this.db.prepare(sql);
        if (stmt.reader)
            return stmt.all(...(params || []));
        stmt.run(...(params || []));
        return [];
    }
    async *stream(sql, params) {
        const iter = this.db.prepare(sql).iterate(...(params || []));
        for (const row of iter) {
            yield row;
        }
    }
}
export class OracleExecutor {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async query(sql, params) {
        const result = await this.conn.execute(sql, (params || []), { outFormat: 4002 /* oracledb.OUT_FORMAT_OBJECT */ });
        return (result.rows || []);
    }
    async *stream(sql, params) {
        // Oracledb provides queryStream
        const stream = this.conn.queryStream(sql, (params || []), { outFormat: 4002 });
        for await (const row of stream) {
            yield row;
        }
    }
}
export class SqlServerExecutor {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    prepare(req, params) {
        if (params) {
            for (let i = 0; i < params.length; i++) {
                req.input(`p${i + 1}`, params[i]);
            }
        }
        return req;
    }
    async query(sql, params) {
        const req = this.prepare(this.pool.request(), params);
        return new Promise((resolve, reject) => {
            const rows = [];
            req.on('row', (row) => rows.push(row));
            req.on('error', reject);
            req.on('done', () => resolve(rows));
            req.query(sql);
        });
    }
    async *stream(sql, params) {
        const req = this.prepare(this.pool.request(), params);
        req.stream = true;
        const rowBuffer = [];
        let resolveNext = null;
        let error = null;
        let isDone = false;
        req.on('row', (row) => {
            rowBuffer.push(row);
            if (resolveNext) {
                resolveNext({ value: rowBuffer.shift(), done: false });
                resolveNext = null;
            }
            else {
                req.pause();
            }
        });
        req.on('error', (err) => { error = err; if (resolveNext) {
            resolveNext(null);
            resolveNext = null;
        } });
        req.on('done', () => { isDone = true; if (resolveNext) {
            resolveNext({ value: undefined, done: true });
            resolveNext = null;
        } });
        req.query(sql);
        while (true) {
            if (error) {
                throw error;
            }
            else if (rowBuffer.length > 0) {
                yield rowBuffer.shift();
                req.resume();
            }
            else if (isDone) {
                return;
            }
            else {
                await new Promise((res) => { resolveNext = res; });
            }
        }
    }
}
