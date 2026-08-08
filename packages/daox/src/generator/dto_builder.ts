import { TableSchema } from '../introspection/types.js';
import { toSafeTsIdentifier } from './escape.js';

/**
 * Safely escapes string literals neutralizing quote breakage inside generated TypeScript signatures.
 * @param str - The raw unverified string property name.
 * @returns The safely escaped string.
 */
function escapeStringLiteral(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * AOT DTO (Data Transfer Object) generator engine.
 * Computes exact TypeScript interfaces representing the physical architecture of the Database Row.
 * Infers strict `Omit` and `Partial` logic determining which columns are required vs auto-incremented or defaulted.
 *
 * @param table - The introspected Table AST schema structure.
 * @returns A strict block of TypeScript code containing `Row`, `Insert`, and `Patch` boundaries.
 */
export function buildTableInterfaces(table: TableSchema): string {
  const safeTable = toSafeTsIdentifier(table.name, 'table');
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
