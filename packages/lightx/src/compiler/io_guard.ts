/**
 * Sécurité absolue empêchant les failles vectorielles système (RCE, path traversal).
 */
import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

export function secureResolve(base: string, target: string): string {
  const resolvedBase = realpathSync(base);
  const resolvedTarget = realpathSync(resolve(resolvedBase, target));

  // S'assurer que la base se termine bien par un séparateur pour éviter le cas `base-hacked` s'appuyant sur un préfixe commun
  const securedBase = resolvedBase.endsWith(sep) ? resolvedBase : resolvedBase + sep;

  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(securedBase)) {
    throw new Error(`Security Violation: Path traversal detected. Target path is outside base directory.`);
  }

  return resolvedTarget;
}
