export function mapSqlTypeToTs(dialect, sqlType) {
    const norm = sqlType.toLowerCase().trim();
    // 1. Mandatory rules
    if (['int8', 'bigint', 'bigserial'].includes(norm))
        return 'bigint';
    if (['boolean', 'bool', 'tinyint(1)'].includes(norm))
        return 'boolean';
    if (['json', 'jsonb'].includes(norm))
        return 'Record<string, unknown> | unknown[]';
    if (['int4', 'integer', 'serial', 'int', 'smallint', 'tinyint', 'mediumint'].includes(norm)) {
        if (dialect === 'mysql' && (norm === 'tinyint(1)' || norm === 'bool' || norm === 'boolean'))
            return 'boolean';
        return 'number';
    }
    // 2. Pragmatic mappings based on spec fallback restrictions (Zero fallback)
    if (norm.includes('varchar') || norm.includes('text') || norm.includes('char') || norm.includes('string') || norm.includes('clob') || norm.includes('uuid') || norm.includes('enum'))
        return 'string';
    if (norm.includes('date') || norm.includes('time') || norm.includes('timestamp'))
        return 'Date';
    if (norm.includes('numeric') || norm.includes('decimal') || norm.includes('float') || norm.includes('double') || norm.includes('real') || norm.includes('number'))
        return 'number';
    if (norm.includes('blob') || norm.includes('bytea') || norm.includes('binary'))
        return 'Buffer';
    throw new Error(`SECURITY: Unsupported SQL Type <${sqlType}>`);
}
