import * as path from 'path';
export function validateOutputPath(reqPath, rootDir) {
    const finalOut = path.resolve(rootDir, reqPath);
    const strictRoot = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
    if (!finalOut.startsWith(strictRoot) && finalOut !== rootDir) {
        throw new Error("SECURITY: Path Traversal Attempt");
    }
    return finalOut;
}
