import { DatabaseSchema } from './types.js';

/**
 * Military-grade hardware limitation gatekeeper.
 * Asserts pre-build conditions computationally verifying that the incoming database 
 * schema structure will not induce an Out Of Memory (OOM) / Heap Exhaustion vector
 * during the AOT Generation phase.
 * 
 * @param schema The entire topological schema structure parsed from the Database dialect.
 * @throws {Error} Immediately panics and halts process if bounds exceed acceptable maximum dimensions.
 */
export function assertMemoryBounds(schema: DatabaseSchema): void {
  // Enforces a strict upper architectural limit of 5,000 extreme-width tables 
  // or a solitary table exceeding 1,000 highly-complex columns.
  if (schema.tables.length > 5000 || Object.values(schema.tables).some(t => t.columns.length > 1000)) {
    throw new Error("SECURITY: Schema exceeds memory bounds");
  }
}
