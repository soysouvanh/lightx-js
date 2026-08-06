function escapeStringLiteral(str) {
    return str.replace(/"/g, '\\"');
}
export function buildTableInterfaces(table) {
    const safeTable = table.name.replace(/[^a-zA-Z0-9_$]/g, '_');
    const entity = safeTable.charAt(0).toUpperCase() + safeTable.slice(1);
    let rowProps = '';
    for (const c of table.columns) {
        const nullableMark = c.isNullable ? ' | null' : '';
        rowProps += `  "${escapeStringLiteral(c.name)}": ${c.typeLocal}${nullableMark};\n`;
    }
    const autoIncCols = table.columns.filter(c => c.isAutoIncrement).map(c => `"${escapeStringLiteral(c.name)}"`).join(' | ');
    const defaultCols = table.columns.filter(c => c.hasDefault && !c.isAutoIncrement).map(c => `"${escapeStringLiteral(c.name)}"`).join(' | ');
    let insertType = `${entity}Row`;
    const omittedCols = [...(autoIncCols ? [autoIncCols] : []), ...(defaultCols ? [defaultCols] : [])].join(' | ');
    if (omittedCols) {
        insertType = `Omit<${entity}Row, ${omittedCols}>`;
    }
    if (defaultCols) {
        insertType += ` & Partial<Pick<${entity}Row, ${defaultCols}>>`;
    }
    return `
export interface ${entity}Row {
${rowProps}}

export type ${entity}Insert = ${insertType};
export type ${entity}Patch = Partial<${entity}Insert>;
`.trim() + '\n';
}
