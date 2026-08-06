/**
 * Absolute interface for all Database Engines (PostgreSQL, MySQL, SQLite, Oracle, SQL Server).
 * This acts as a completely stateless bridge, enabling native C++ driver execution 
 * without injecting any ORM overhead or connection global state.
 */
export interface GenericExecutor {
  /**
   * Executes a strict raw SQL query and maps the result mathematically into memory.
   * @param sql Complete SQL string structure securely built AOT.
   * @param params Bound native parameters strictly passing through the C++ driver to prevent Injection.
   * @returns Resolves the complete strict row mapping.
   */
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Evaluates the query into a deterministic AsyncIterable stream.
   * Conceptually enforces $O(1)$ live memory allocation regardless of dataset size.
   * @param sql Complete SQL string structure securely built AOT.
   * @param params Bound native parameters bridging the C++ engine.
   * @returns An AsyncIterable iterator capable of yielding streams dynamically.
   */
  stream<T>(sql: string, params?: unknown[]): AsyncIterable<T>;
}
