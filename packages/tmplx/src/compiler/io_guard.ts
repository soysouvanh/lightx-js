import path from "node:path";
import fs from "node:fs";

const ALLOWED_EXTENSIONS = new Set([".html", ".htm"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB hard limit

export function secureResolve(reqPath: string, baseDir: string): string {
  const resolved = path.resolve(baseDir, reqPath);

  // 1. Vérification d'existence avant realpathSync (évite stacktrace leak)
  if (!fs.existsSync(resolved)) {
    throw new Error(`SECURITY: Template not found - ${reqPath}`);
  }

  // 2. Résolution absolue incluant la traversée des Symlinks
  const target = fs.realpathSync(resolved);
  const root = fs.realpathSync(baseDir);

  // 3. Clôture géométrique (Path Traversal)
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error(`SECURITY: Path Traversal Attempt - ${reqPath}`);
  }

  // 4. Whitelist d'extensions (bloque .env, .ts, .json, etc.)
  if (!ALLOWED_EXTENSIONS.has(path.extname(target).toLowerCase())) {
    throw new Error(`SECURITY: Forbidden file extension - ${reqPath}`);
  }

  // 5. Limite de taille du fichier (anti-DoS) et blocage de dossiers
  const stat = fs.statSync(target);
  if (!stat.isFile()) {
    throw new Error(`SECURITY: Target is not a file - ${reqPath}`);
  }
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`SECURITY: File exceeds 2MB limit - ${reqPath}`);
  }

  return target;
}
