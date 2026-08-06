/**
 * =========================================================================
 * DAOX INTROSPECTION & TOPOLOGY AST
 * =========================================================================
 * Acts as the absolute semantic contract (Abstract Syntax Tree) representing 
 * the mathematical extraction of the source SQL network. 
 * This rigid blueprint guarantees that Daox generates 100% predictable, statically 
 * verifiable TypeScript architectures without requiring runtime inference.
 */

/**
 * Central Blueprint defining the Abstract Syntax Tree (AST) of the Database Schema.
 * Used across the entire Daox engine to infer deterministic TypeScript generators without runtime reflection.
 */
export interface DatabaseSchema {
  /** Map of all meticulously introspected tables ready for AOT extraction. */
  tables: TableSchema[];
}

/**
 * Mathematical Topology representing a strict standalone SQL Table or View.
 */
export interface TableSchema {
  /** The authentic, raw table namespace explicitly utilized by the SQL engine. */
  name: string;
  /** Granular structural definitions of every scalar column. */
  columns: ColumnSchema[];
  /** 
   * Strict registry of Primary Keys. Crucial for triggering YAGNI generation mechanics 
   * (e.g. \`findById\`, \`updatePartialById\`, \`deleteById\`). 
   */
  primaryKeys: string[];
  /** Extracted native SQL Indexes for automated fast-path read generations. */
  indexes: IndexSchema[];
}

/**
 * Deep, hardware-level mapping of a single SQL Column structure into Type Space.
 */
export interface ColumnSchema {
  /** Authentic column identifier without transformations. */
  name: string;
  /** The native SQL Engine Type extracted via Dialect introspection (e.g. \`varchar\`, \`int\`). */
  sqlType: string;
  /** The target Local language type evaluated strictly by the Type Mapper (e.g. \`string\`, \`number\`). */
  typeLocal: string;
  /** Determines structural Optionality (\`?\`) in TypeScript generation arrays. */
  isNullable: boolean;
  /** Triggers the omission of the column during Insertion interfaces if a DB Default resolves it. */
  hasDefault: boolean;
  /** Maps natively to Identity/Auto-Increment columns, omitting them from structural Inserts. */
  isAutoIncrement: boolean;
}

/**
 * Relational Topology extraction for fast-path SQL read operations.
 */
export interface IndexSchema {
  /** Native Index internal identifier. */
  name: string;
  /** Sequences of columns dictating the physical node structure of the B-Tree index. */
  columns: string[];
  /** 
   * Crucial parameter determining whether Daox generates a Singular Resolver (\`findBy...\`) 
   * or a Multiple Resolver (\`findAllBy...\`). 
   */
  isUnique: boolean;
}
