import path from 'node:path';
import fs from 'node:fs';

/**
 * Strict whitelist of allowed output extensions for single-file mode.
 * Only TypeScript source files are permitted to prevent arbitrary file writes.
 */
const ALLOWED_OUTPUT_EXTENSIONS = new Set(['.ts']);

/**
 * Validates and resolves the output file path, enforcing:
 * 1. Symlink-proof Path Traversal prevention (CWE-22) via `fs.realpathSync`.
 * 2. Extension whitelist (only `.ts` is permitted).
 * 3. Parent directory existence verification.
 *
 * @param reqPath - The requested output path from CLI parameters.
 * @param rootDir - The CWD boundary lock.
 * @returns The resolved, validated absolute path.
 * @throws {Error} On path traversal attempt, missing parent, or forbidden extension.
 */
export function validateOutputPath(reqPath: string, rootDir: string): string {
  const finalOut = path.resolve(rootDir, reqPath);
  const root = fs.realpathSync(rootDir);

  // 1. Symlink-proof geometric closure (anti-Path Traversal)
  const parentDir = path.dirname(finalOut);
  if (!fs.existsSync(parentDir)) {
    throw new Error('SECURITY: Output directory does not exist');
  }
  const realParent = fs.realpathSync(parentDir);
  if (!realParent.startsWith(root + path.sep) && realParent !== root) {
    throw new Error('SECURITY: Path Traversal Attempt');
  }

  // 2. Extension whitelist (only .ts authorized)
  if (!ALLOWED_OUTPUT_EXTENSIONS.has(path.extname(finalOut).toLowerCase())) {
    throw new Error('SECURITY: Output file must have .ts extension');
  }

  return path.join(realParent, path.basename(finalOut));
}

/**
 * Validates and resolves the output directory path, enforcing:
 * 1. Symlink-proof Path Traversal prevention (CWE-22) via `fs.realpathSync`.
 * 2. Parent directory existence verification.
 *
 * Unlike `validateOutputPath`, this does not enforce extension whitelist
 * since the target is a directory, not a file.
 *
 * @param reqPath - The requested output directory path from CLI parameters.
 * @param rootDir - The CWD boundary lock.
 * @returns The resolved, validated absolute directory path.
 * @throws {Error} On path traversal attempt.
 */
export function validateOutputDir(reqPath: string, rootDir: string): string {
  const finalOut = path.resolve(rootDir, reqPath);
  const root = fs.realpathSync(rootDir);

  // If the directory already exists, resolve symlinks and verify containment
  if (fs.existsSync(finalOut)) {
    const realOut = fs.realpathSync(finalOut);
    if (!realOut.startsWith(root + path.sep) && realOut !== root) {
      throw new Error('SECURITY: Path Traversal Attempt');
    }
    return realOut;
  }

  // If it doesn't exist yet, verify its parent is within the root boundary
  const parentDir = path.dirname(finalOut);
  if (!fs.existsSync(parentDir)) {
    throw new Error('SECURITY: Output parent directory does not exist');
  }
  const realParent = fs.realpathSync(parentDir);
  if (!realParent.startsWith(root + path.sep) && realParent !== root) {
    throw new Error('SECURITY: Path Traversal Attempt');
  }

  return path.join(realParent, path.basename(finalOut));
}
