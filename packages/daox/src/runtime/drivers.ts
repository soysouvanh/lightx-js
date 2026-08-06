import type { Sql } from 'postgres';
import type { Connection } from 'mysql2/promise';
import type { Database } from 'better-sqlite3';
import type { Connection as OracleConnection } from 'oracledb';
import type { ConnectionPool } from 'mssql';

import { GenericExecutor } from './executor.js';

/**
 * =========================================================================
 * DAOX NATIVE DRIVER INTEGRATIONS
 * =========================================================================
 * This module physically implements the GenericExecutor architectural boundary for each major SQL dialect.
 * It rigorously maps the internal Daox streaming abstractions ($O(1)$) directly to the specific C/C++ native Node.js binaries.
 * None of these drivers natively share the exact same cursor logic; hence, these bridging classes 
 * mathematically equalize their behaviors into the strict Daox AsyncIterable paradigm.
 */

export class PostgresExecutor implements GenericExecutor {
  constructor(private sql: Sql<{}>) {}

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    return (await this.sql.unsafe(sql, params as any[])) as unknown as T[];
  }

  async *stream<T>(sql: string, params?: unknown[]): AsyncIterable<T> {
    const cursor = this.sql.unsafe(sql, params as any[]).cursor(100);
    for await (const chunk of cursor) {
      for (const row of (chunk as any[])) {
        yield row as T;
      }
    }
  }
}

interface MysqlRawConn {
  connection: {
    execute(sql: string, params: unknown[]): { stream(): AsyncIterable<unknown> };
  };
}

export class MysqlExecutor implements GenericExecutor {
  constructor(private conn: Connection) {}

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const [rows] = await this.conn.execute(sql, (params || []) as never[]);
    return rows as T[];
  }

  async *stream<T>(sql: string, params?: unknown[]): AsyncIterable<T> {
    const stream = (this.conn as unknown as MysqlRawConn).connection.execute(sql, params || []).stream();
    for await (const row of stream) {
      yield row as T;
    }
  }
}

export class SqliteExecutor implements GenericExecutor {
  constructor(private db: Database) {}

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    if (stmt.reader) return stmt.all(...(params || [])) as T[];
    stmt.run(...(params || []));
    return [];
  }

  async *stream<T>(sql: string, params?: unknown[]): AsyncIterable<T> {
    const iter = this.db.prepare(sql).iterate(...(params || []));
    for (const row of iter) {
      yield row as T;
    }
  }
}

export class OracleExecutor implements GenericExecutor {
  constructor(private conn: OracleConnection) {}

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.conn.execute<T>(sql, (params || []) as never[], { outFormat: 4002 /* oracledb.OUT_FORMAT_OBJECT */ });
    return (result.rows || []);
  }

  async *stream<T>(sql: string, params?: unknown[]): AsyncIterable<T> {
    // Oracledb provides queryStream
    const stream = this.conn.queryStream(sql, (params || []) as never[], { outFormat: 4002 }) as unknown as AsyncIterable<T>;
    for await (const row of stream) {
      yield row;
    }
  }
}

interface MsSqlRequest {
  stream: boolean;
  query(sql: string): void;
  input(name: string, value: unknown): MsSqlRequest;
  on(event: string, callback: (...args: unknown[]) => void): MsSqlRequest;
  pause(): void;
  resume(): void;
}

export class SqlServerExecutor implements GenericExecutor {
  constructor(private pool: ConnectionPool) {}

  private prepare(req: MsSqlRequest, params?: unknown[]) {
    if (params) {
      for (let i = 0; i < params.length; i++) {
        req.input(`p${i + 1}`, params[i]);
      }
    }
    return req;
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const req = this.prepare(this.pool.request() as unknown as MsSqlRequest, params);
    return new Promise((resolve, reject) => {
      const rows: T[] = [];
      req.on('row', (row) => rows.push(row as T));
      req.on('error', reject);
      req.on('done', () => resolve(rows));
      req.query(sql);
    });
  }

  async *stream<T>(sql: string, params?: unknown[]): AsyncIterable<T> {
    const req = this.prepare(this.pool.request() as unknown as MsSqlRequest, params);
    req.stream = true;

    const rowBuffer: T[] = [];
    let resolveNext: ((value: IteratorResult<T>) => void) | null = null;
    let error: Error | null = null;
    let isDone = false;

    req.on('row', (row) => {
      rowBuffer.push(row as T);
      if (resolveNext) {
        resolveNext({ value: rowBuffer.shift()!, done: false });
        resolveNext = null;
      } else {
        req.pause();
      }
    });
    req.on('error', (err) => { error = err as Error; if (resolveNext) { resolveNext(null as any); resolveNext = null; } });
    req.on('done', () => { isDone = true; if (resolveNext) { resolveNext({ value: undefined, done: true }); resolveNext = null; } });

    req.query(sql);

    while (true) {
      if (error) {
        throw error;
      } else if (rowBuffer.length > 0) {
        yield rowBuffer.shift()!;
        req.resume();
      } else if (isDone) {
        return;
      } else {
        await new Promise<IteratorResult<T>>((res) => { resolveNext = res; });
      }
    }
  }
}
