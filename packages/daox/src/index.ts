/**
 * =========================================================================
 * DAOX RUNTIME EDGE
 * =========================================================================
 * This represents the sole public interface accessible in production.
 * Exposes strictly the Stateless Executors and Drivers to instantiate 
 * native boundaries connecting generated DAOs to physical connection pools.
 */
export * from './runtime/executor.js';
export * from './runtime/drivers.js';
export { escapeIdentifier } from './generator/escape.js';
