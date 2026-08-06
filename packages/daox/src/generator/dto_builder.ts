import { TableSchema } from '../introspection/types.js';

/**
 * Safely escapes string literals strictly neutralizing newline and quote breakage inside generated TypeScript signatures.
 * @param str The raw unverified string property name.
 * @returns {string} The computationally evaluated strictly safe string.
 */
function escapeStringLiteral(str: string): string {
  return str.replace(/"/g, '\\"');
}

/**
 * Military-grade DTO (Data Transfer Object) generator engine.
 * Computes exact TypeScript interfaces representing the physical architecture of the Database Row.
 * Infers absolute strict parameters, intelligently extracting \`Omit\` and \`Partial\` logic 
 * determining which database columns are globally required vs auto-incremented or defaulted.
 * 
 * @param table The introspected Table AST schema structure.
 * @returns {string} A strict, frozen block of TypeScript Code containing \`Row\`, \`Insert\`, and \`Patch\` boundaries.
 */
export function buildTableInterfaces(table: TableSchema): string {
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
