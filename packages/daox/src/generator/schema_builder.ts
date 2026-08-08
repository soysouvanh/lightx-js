import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { DatabaseSchema } from '../introspection/types.js';
import { toSafeTsIdentifier } from './escape.js';

function isObjectRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

function extractNodeValue(node: ts.Expression): unknown {
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return (node as ts.LiteralExpression).text;
  if (ts.isNumericLiteral(node)) return Number((node as ts.LiteralExpression).text);
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(e => extractNodeValue(e));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const obj: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop) && prop.name && ts.isIdentifier(prop.name)) {
        obj[prop.name.text] = extractNodeValue(prop.initializer);
      }
    }
    return obj;
  }
  return undefined;
}

function parseTsOverride(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, 'utf8');
  const ast = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  let parsed: Record<string, unknown> = {};
  
  ts.forEachChild(ast, (node) => {
    // Looks for: export default { ... }
    if (ts.isExportAssignment(node)) {
      if (ts.isObjectLiteralExpression(node.expression)) {
        const extracted = extractNodeValue(node.expression);
        if (isObjectRecord(extracted)) parsed = extracted;
      }
    }
  });
  return parsed;
}

function getBoolOption(parsed: Record<string, unknown>, key: string): boolean | undefined {
  if (Object.prototype.hasOwnProperty.call(parsed, key)) {
    const section = parsed[key];
    if (isObjectRecord(section) && Object.prototype.hasOwnProperty.call(section, 'value')) {
      const val = section.value;
      if (typeof val === 'boolean') return val;
    }
  }
  return undefined;
}

function getStringOption(parsed: Record<string, unknown>, key: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(parsed, key)) {
    const section = parsed[key];
    if (isObjectRecord(section) && Object.prototype.hasOwnProperty.call(section, 'value')) {
      const val = section.value;
      if (typeof val === 'string') return val;
    }
  }
  return undefined;
}

function getNumberOption(parsed: Record<string, unknown>, key: string): number | undefined {
  if (Object.prototype.hasOwnProperty.call(parsed, key)) {
    const section = parsed[key];
    if (isObjectRecord(section) && Object.prototype.hasOwnProperty.call(section, 'value')) {
      const val = section.value;
      if (typeof val === 'number') return val;
    }
  }
  return undefined;
}

function getArrayOption(parsed: Record<string, unknown>, key: string): string[] | undefined {
  if (Object.prototype.hasOwnProperty.call(parsed, key)) {
    let val = parsed[key];
    if (isObjectRecord(val) && 'value' in val) {
      val = val.value;
    }
    if (Array.isArray(val)) {
      return val.filter(v => typeof v === 'string') as string[];
    }
  }
  return undefined;
}

export function weaveSchemaOverrides(
  outDir: string,
  schema: DatabaseSchema
): void {
  const baseDir = path.resolve(outDir, 'schema');
  const overrideDir = path.resolve(outDir, '../dao_overrides/schema');

  for (const table of schema.tables) {
    const safeTable = toSafeTsIdentifier(table.name, 'table');
    const baseTableDir = path.join(baseDir, safeTable);
    const overrideTableDir = path.join(overrideDir, safeTable);
    
    // Always regenerate base boundaries (Zero-Trust representation)
    fs.mkdirSync(baseTableDir, { recursive: true });

    let existingOverrides = new Set<string>();
    try {
      // O(1) Cache via purely readdir to eliminate N-Syscalls inside the column loop
      existingOverrides = new Set(fs.readdirSync(overrideTableDir));
      console.log('  -> Override folder processed: ' + safeTable);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        fs.mkdirSync(overrideTableDir, { recursive: true });
        console.log('  -> Override folder created: ' + safeTable);
      } else {
        throw err;
      }
    }

    // _table.ts Baseline
    const defaultTableContent = `export default {\n  database: "default"\n};\n`;
    fs.writeFileSync(path.join(baseTableDir, '_table.ts'), defaultTableContent);

    // O(1) Acceleration pre-computations for absolute performance (Bare Metal SOTA)
    const pkSet = new Set(table.primaryKeys);
    const indexCols = new Set<string>();
    const uniqueCols = new Set<string>();

    for (const idx of table.indexes) {
      for (const c of idx.columns) {
        indexCols.add(c);
        if (idx.isUnique) uniqueCols.add(c);
      }
    }

    // Baseline & Overrides for each column
    for (const col of table.columns) {
      const safeCol = toSafeTsIdentifier(col.name, 'col');
      const colTsFileName = `${safeCol}.ts`;
      const baseColTsPath = path.join(baseTableDir, colTsFileName);
      const overrideColTsPath = path.join(overrideTableDir, colTsFileName);
      
      const isPrimaryKey = pkSet.has(col.name);
      const isIndex = indexCols.has(col.name);
      const isUnique = uniqueCols.has(col.name);

      // Baseline mathematical limits resolution from introspection
      col.minLength = col.minLength ?? 1;
      col.maxLength = col.maxLength ?? 255;
      col.minValue = col.minValue ?? 0;
      col.maxValue = col.maxValue ?? 9007199254740991;

      // Output structural baseline to dao/schema (Read-Only Reference)
      const defaultColContent = `export default {\n` +
        `  business_rules: [],\n` +
        `  enum_values: { value: [] },\n` +
        `  format: {\n` +
        `    message: "schema.format.message",\n` +
        `    value: ""\n` +
        `  },\n` +
        `  has_default: { value: ${col.hasDefault} },\n` +
        `  is_auto_increment: { value: ${col.isAutoIncrement} },\n` +
        `  is_generated: { value: false },\n` +
        `  is_index: { value: ${isIndex} },\n` +
        `  is_optional: {\n` +
        `    message: "schema.is_optional.message",\n` +
        `    value: ${col.isNullable}\n` +
        `  },\n` +
        `  is_primary_key: { value: ${isPrimaryKey} },\n` +
        `  is_unique: { value: ${isUnique} },\n` +
        `  max_length: {\n` +
        `    message: "schema.max_length.message|${col.maxLength}",\n` +
        `    value: ${col.maxLength}\n` +
        `  },\n` +
        `  max_value: {\n` +
        `    message: "schema.max_value.message|${col.maxValue}",\n` +
        `    value: ${col.maxValue}\n` +
        `  },\n` +
        `  min_length: {\n` +
        `    message: "schema.min_length.message|${col.minLength}",\n` +
        `    value: ${col.minLength}\n` +
        `  },\n` +
        `  min_value: {\n` +
        `    message: "schema.min_value.message|${col.minValue}",\n` +
        `    value: ${col.minValue}\n` +
        `  },\n` +
        `  type: {\n` +
        `    message: "schema.type.message",\n` +
        `    value: "${col.typeLocal}"\n` +
        `  }\n` +
        `};\n`;
      fs.writeFileSync(baseColTsPath, defaultColContent);

      // Mutate AST dynamically if the developer provided an override in dao_overrides/schema
      if (existingOverrides.has(colTsFileName)) {
        try {
          const parsed = parseTsOverride(overrideColTsPath);
          
          const overrideHasDefault = getBoolOption(parsed, 'has_default');
          if (overrideHasDefault !== undefined) col.hasDefault = overrideHasDefault;
          
          const overrideIsAutoInc = getBoolOption(parsed, 'is_auto_increment');
          if (overrideIsAutoInc !== undefined) col.isAutoIncrement = overrideIsAutoInc;
          
          const overrideIsOptional = getBoolOption(parsed, 'is_optional');
          if (overrideIsOptional !== undefined) col.isNullable = overrideIsOptional;
          
          const overrideType = getStringOption(parsed, 'type');
          if (overrideType !== undefined) col.typeLocal = overrideType;

          const overrideMinLength = getNumberOption(parsed, 'min_length');
          if (overrideMinLength !== undefined) col.minLength = overrideMinLength;

          const overrideMaxLength = getNumberOption(parsed, 'max_length');
          if (overrideMaxLength !== undefined) col.maxLength = overrideMaxLength;

          const overrideMinValue = getNumberOption(parsed, 'min_value');
          if (overrideMinValue !== undefined) col.minValue = overrideMinValue;

          const overrideMaxValue = getNumberOption(parsed, 'max_value');
          if (overrideMaxValue !== undefined) col.maxValue = overrideMaxValue;

          const overrideFormat = getStringOption(parsed, 'format');
          if (overrideFormat !== undefined && overrideFormat !== "") col.format = overrideFormat;

          const overrideEnumValues = getArrayOption(parsed, 'enum_values');
          if (overrideEnumValues !== undefined && overrideEnumValues.length > 0) col.enumValues = overrideEnumValues;

          const overrideBusinessRules = getArrayOption(parsed, 'business_rules');
          if (overrideBusinessRules !== undefined && overrideBusinessRules.length > 0) col.businessRules = overrideBusinessRules;
          
          const overrideIsPk = getBoolOption(parsed, 'is_primary_key');
          if (overrideIsPk !== undefined) {
            if (overrideIsPk) {
              if (!table.primaryKeys.includes(col.name)) table.primaryKeys.push(col.name);
            } else {
              table.primaryKeys = table.primaryKeys.filter(pk => pk !== col.name);
            }
          }
          
          const overrideIndex = getBoolOption(parsed, 'is_index');
          const overrideUnique = getBoolOption(parsed, 'is_unique');
          
          if (overrideIndex !== undefined || overrideUnique !== undefined) {
            const shouldBeIndex = overrideIndex !== undefined ? overrideIndex : indexCols.has(col.name);
            const shouldBeUnique = overrideUnique !== undefined ? overrideUnique : uniqueCols.has(col.name);

            if (!shouldBeIndex) {
              table.indexes = table.indexes.filter(idx => !idx.columns.includes(col.name));
            } else {
              let existingIdx = table.indexes.find(idx => idx.columns.includes(col.name) && idx.columns.length === 1);
              if (existingIdx) {
                existingIdx.isUnique = shouldBeUnique;
              } else {
                table.indexes.push({ name: `idx_override_${col.name}`, columns: [col.name], isUnique: shouldBeUnique });
              }
            }
          }
        } catch (e) {
          console.warn(`[Daox Schema] Failed to parse override TS for ${table.name}.${col.name}:`, e);
        }
      }
    }
  }
}
