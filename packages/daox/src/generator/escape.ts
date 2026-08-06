/**
 * Military-grade Semantic Security Wrapper.
 * Exclusively responsible for structurally escaping table and column identifiers across varied Engines.
 * Mitigates SQL Injection vectors (such as quote hopping or delimiter breakage) mathematically at build-time.
 * 
 * @param dialect The underlying specific SQL architecture (e.g. 'postgres', 'mysql', 'mssql').
 * @param identifier The raw, unverified string fragment mapped from database introspection.
 * @returns The computationally hardened, safely quoted identifier string.
 * @throws {Error} Immediately panics for unknown or unverified dialects.
 */
export function escapeIdentifier(dialect: string, identifier: string): string {
  switch (dialect.toLowerCase()) {
    case 'postgres':
    case 'oracle':
    case 'sqlite':
      return `"${identifier.replace(/"/g, '""')}"`;
    case 'mysql':
      return `\`${identifier.replace(/`/g, '``')}\``;
    case 'mssql':
    case 'sqlserver':
      return `[${identifier.replace(/\]/g, ']]')}]`;
    default:
      throw new Error(`SECURITY: Unsupported dialect for escaping: ${dialect}`);
  }
}
