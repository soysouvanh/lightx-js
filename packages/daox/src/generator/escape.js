export function escapeIdentifier(dialect, identifier) {
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
