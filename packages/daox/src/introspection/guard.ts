import { DatabaseSchema } from './types.js';

/**
 * Pre-build DoS mitigation gatekeeper (Tache 5.2).
 * Asserts that the incoming database schema will not induce OOM / Heap Exhaustion
 * during the AOT generation phase.
 *
 * Uses separate checks with distinct error messages to enable precise diagnostics.
 *
 * @param schema - The topological schema structure parsed from the database dialect.
 * @throws {Error} Immediately halts if bounds exceed acceptable maximum dimensions.
 */
export function assertMemoryBounds(schema: DatabaseSchema): void {
  if (schema.tables.length > 5000) {
    throw new Error('SECURITY: Schema exceeds table limit (5000)');
  }
  for (const table of schema.tables) {
    if (table.columns.length > 1000) {
      throw new Error('SECURITY: Table exceeds column limit (1000)');
    }
  }
}
