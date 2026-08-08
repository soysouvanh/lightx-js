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

/**
 * Safely converts an arbitrary SQL identifier into a valid TypeScript identifier.
 * Ensures the generated code compiles successfully (e.g., prefixing numbers if it starts with one).
 * Mitigates SyntaxErrors dynamically injected via non-conforming table or column schemas.
 */
export function toSafeTsIdentifier(name: string, fallback: string = 'empty'): string {
  let safe = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  if (!safe) safe = '_' + fallback + '_';
  if (/^[0-9]/.test(safe)) {
    return '_' + safe;
  }
  return safe;
}
