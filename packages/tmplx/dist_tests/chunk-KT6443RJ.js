// src/compiler/io_guard.ts
import path from "path";
import fs from "fs";
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([".html", ".htm"]);
var MAX_FILE_SIZE = 2 * 1024 * 1024;
function secureResolve(reqPath, baseDir) {
  const resolved = path.resolve(baseDir, reqPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`SECURITY: Template not found - ${reqPath}`);
  }
  const target = fs.realpathSync(resolved);
  const root = fs.realpathSync(baseDir);
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error(`SECURITY: Path Traversal Attempt - ${reqPath}`);
  }
  if (!ALLOWED_EXTENSIONS.has(path.extname(target).toLowerCase())) {
    throw new Error(`SECURITY: Forbidden file extension - ${reqPath}`);
  }
  const stat = fs.statSync(target);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`SECURITY: File exceeds 2MB limit - ${reqPath}`);
  }
  return target;
}

export {
  secureResolve
};
