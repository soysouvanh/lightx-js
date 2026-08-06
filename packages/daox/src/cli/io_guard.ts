import * as path from 'path';

/**
 * Military-grade Input/Output security gatekeeper.
 * Strictly mitigates absolute and relative Directory Traversal capabilities (CWE-22) 
 * ensuring that the generator only outputs file structures explicitly localized within 
 * the project's foundational root directory bounds.
 * 
 * @param reqPath The requested output path string directly passed from CLI parameters.
 * @param rootDir The localized CWD (Current Working Directory) acting as the boundary lock.
 * @returns {string} The computationally evaluated absolute safe path.
 * @throws {Error} Immediately panics and halts process if a Path Traversal attempt is mathematically detected.
 */
export function validateOutputPath(reqPath: string, rootDir: string): string {
  const finalOut = path.resolve(rootDir, reqPath);
  const strictRoot = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  if (!finalOut.startsWith(strictRoot) && finalOut !== rootDir) {
    throw new Error("SECURITY: Path Traversal Attempt");
  }
  return finalOut;
}
