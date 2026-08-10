/**
 * Parseur strict des configurations AOP .ts et .env.
 */
import { readFileSync } from "node:fs";

export interface EnvPools {
  [poolName: string]: string; // "ANALYTICS" -> connexion db
}

export interface RouteConfig {
  method: string;
  path: string;
  businessObjects: string[];
  parameters: Record<string, string>;
  srcDir: string;
  dbName: string;
}

export class Parser {
  /**
   * Tâche 2.1 : Context factory dynamique via `.env`
   * Parse itérativement un fichier `.env` pour déduire les connexions BDD.
   */
  static parseEnv(envPath: string): EnvPools {
    const content = readFileSync(envPath, { encoding: "utf8" });
    const pools: EnvPools = {};
    const lines = content.split("\n");

    for (const line of lines) {
      const match = line.match(/^([A-Z0-9_]+)_DATABASE_URL\s*=\s*(.+)$/);
      if (match && match[1] && match[2]) {
        pools[match[1]] = match[2].trim();
      }
    }
    return pools;
  }

  /**
   * Tâche 2.3 & 2.4 : Sémantique des routes (TS) + Immunité
   * Parseur TS bare-metal 100% strict (whitelist). 
   */
  static async parseHandlerTS(tsPath: string, relativeFilePath?: string): Promise<RouteConfig> {
    const { pathToFileURL } = await import("node:url");
    const content = await import(pathToFileURL(tsPath).href);
    
    // Whitelist stricte
    if (!content.route || !content.route.method) {
      throw new Error(`Invalid TS structure in ${tsPath}: Missing strictly formatted route method.`);
    }

    let { method, path } = content.route;
    const businessObjects = content.pipeline?.business_objects || [];
    
    let dbName = "example";
    let srcDir = "";
    const { resolve, join } = await import("node:path");
    const { existsSync } = await import("node:fs");

    if (relativeFilePath) {
      const normalized = relativeFilePath.replace(/\\/g, '/').replace(/\.(ts|js)$/, '');
      const segments = normalized.split('/');
      
      if (segments.length < 3) {
        throw new Error(`Build Error: L'arborescence est invalide pour déduire le handler de ${tsPath}`);
      }
      
      dbName = segments[0] as string;
      const handlerNameRaw = segments[segments.length - 1] as string;
      const pathDir = segments.slice(1, segments.length - 1).join('/');
      
      srcDir = resolve(tsPath, "../".repeat(segments.length + 1));

      if (!path) {
        const boFileTs = join(srcDir, "bo", dbName, `${pathDir}.ts`);
        const boFileJs = join(srcDir, "bo", dbName, `${pathDir}.js`);
        
        const targetBo = existsSync(boFileTs) ? boFileTs : (existsSync(boFileJs) ? boFileJs : null);
        if (!targetBo) {
           throw new Error(`Build Error: Le handler par défaut n'existe pas. Business object attendu: ${boFileTs}`);
        }

        // Zéro Anomalie Silencieuse: on vérifie et injecte le BO s'il n'a pas été défini
        if (businessObjects.length === 0) {
           const handlerMethod = handlerNameRaw.charAt(0).toLowerCase() + handlerNameRaw.slice(1);
           const boModule = await import(pathToFileURL(targetBo).href);
           if (typeof boModule[handlerMethod] !== 'function') {
             throw new Error(`Build Error: Le handler par défaut '${handlerMethod}' n'est pas exporté sous forme de fonction dans le BO ${targetBo}`);
           }
           businessObjects.push(`./src/bo/${dbName}/${pathDir}.js::${handlerMethod}`);
        }

        path = "/" + segments.map((segment: string) => {
          return segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        }).join('/');
      }
    } else if (!path) {
      throw new Error(`Invalid TS structure in ${tsPath}: Missing strictly formatted route path.`);
    }

    if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      throw new Error(`Security Violation: Unrecognized route method ${method}`);
    }

    const parameters = content.parameters || {};
    
    // Strict AOT Validation against Schema boundaries
    if (srcDir && Object.keys(parameters).length > 0) {
      for (const [key, mapping] of Object.entries(parameters)) {
        if (mapping === "") continue; // Virtual parameter bypass
        
        const dotIndex = (mapping as string).indexOf('.');
        if (dotIndex === -1) {
          throw new Error(`Build Error: Le paramètre '${key}' dans ${tsPath} doit être formatté en 'table.colonne' (reçu: ${mapping})`);
        }
        const table = (mapping as string).substring(0, dotIndex);
        const column = (mapping as string).substring(dotIndex + 1);
        const schemaFileTs = join(srcDir, "schema", dbName, table, `${column}.ts`);
        const schemaFileJs = join(srcDir, "schema", dbName, table, `${column}.js`);
        
        if (!existsSync(schemaFileTs) && !existsSync(schemaFileJs)) {
          throw new Error(`Build Error: Impossible de lier le paramètre '${key}'. La colonne '${table}.${column}' n'existe pas dans le référentiel O(1) de Daox.`);
        }
      }
    }

    return {
      method,
      path,
      businessObjects,
      parameters,
      srcDir,
      dbName
    };
  }
}
