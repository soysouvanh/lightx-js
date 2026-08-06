/**
 * Core Abstract Syntax Tree (AST) Data Mapper.
 * Unconditionally reduces vast native SQL datatypes into precise TypeScript invariants.
 * Ensures the zero-overhead paradigm by converting complex memory constructs directly 
 * ahead of time (AOT) to avoid relying on runtime parsing libraries.
 * 
 * @param dialect The source dialect dictating native type characteristics.
 * @param sqlType The strict raw schema type signature (e.g. \`varchar(255)\`, \`jsonb\`).
 * @returns The computed deterministic TypeScript semantic type (\`string\`, \`number\`, \`Buffer\`, \`Date\`).
 * @throws {Error} Panics upon discovering an uncharted SQL type to block unpredictable states.
 */
export function mapSqlTypeToTs(dialect: string, sqlType: string): string {
  const norm = sqlType.toLowerCase().trim();

  // 1. Mandatory rules
  if (['int8', 'bigint', 'bigserial'].includes(norm)) return 'bigint';
  if (['boolean', 'bool', 'tinyint(1)'].includes(norm)) return 'boolean';
  if (['json', 'jsonb'].includes(norm)) return 'Record<string, unknown> | unknown[]';
  
  if (['int4', 'integer', 'serial', 'int', 'smallint', 'tinyint', 'mediumint'].includes(norm)) {
    if (dialect === 'mysql' && (norm === 'tinyint(1)' || norm === 'bool' || norm === 'boolean')) return 'boolean';
    return 'number';
  }

  // 2. Pragmatic mappings based on spec fallback restrictions (Zero fallback)
  if (norm.includes('varchar') || norm.includes('text') || norm.includes('char') || norm.includes('string') || norm.includes('clob') || norm.includes('uuid') || norm.includes('enum')) return 'string';
  if (norm.includes('date') || norm.includes('time') || norm.includes('timestamp')) return 'Date';
  if (norm.includes('numeric') || norm.includes('decimal') || norm.includes('float') || norm.includes('double') || norm.includes('real') || norm.includes('number')) return 'number';
  if (norm.includes('blob') || norm.includes('bytea') || norm.includes('binary')) return 'Buffer';

  throw new Error(`SECURITY: Unsupported SQL Type <${sqlType}>`);
}
