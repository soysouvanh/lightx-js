export function assertMemoryBounds(schema) {
    if (schema.tables.length > 5000 || Object.values(schema.tables).some(t => t.columns.length > 1000)) {
        throw new Error("SECURITY: Schema exceeds memory bounds");
    }
}
