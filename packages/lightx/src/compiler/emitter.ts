/**
 * Transpilateur AOT de fonctions de routage et sérialiseurs JSON TS.
 */
import type { EnvPools, RouteConfig } from "./parser.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class Emitter {
  /**
   * Tâche 2.1 : Context factory dynamique
   * Génère les méthodes dynamiques d'accès aux pools BDD pour injecter dans le prototype ou la factory O(1).
   */
  static emitContextPoolAccessors(pools: EnvPools): string {
    let code = ``;
    for (const poolName of Object.keys(pools)) {
      // Ex: ANALYTICS -> getAnalyticsPool
      const methodName = `get${poolName.charAt(0).toUpperCase() + poolName.slice(1).toLowerCase()}Pool`;
      code += `  ${methodName}() {\n`;
      code += `    return this._pools['${poolName}'];\n`;
      code += `  }\n\n`;
    }
    return code;
  }

  /**
   * Tâche 2.2 : Sérialiseurs JSON AOT
   * Compile statiquement un formateur de chaîne JSON à partir d'une définition typée (ex: schema statique).
   * Note: Implementation basique pour Phase 2.
   */
  static emitJsonSerializer(shape: Record<string, "string" | "number" | "boolean">): string {
    const parts: string[] = [];
    for (const [key, type] of Object.entries(shape)) {
      if (type === "string") {
        parts.push(`'\"${key}\":\"' + data.${key} + '\"'`);
      } else {
        parts.push(`'\"${key}\":' + data.${key}`);
      }
    }
    return `function serializeAOT(data: Record<string, unknown>): string {\n  return '{' + ${parts.join(" + ',' + ")} + '}';\n}`;
  }

  /**
   * Tâche 2.4 : Pare-feu de validation structuré (scanner AOT)
   * Émission de structures de validation linéaires natives O(1).
   */
  static emitValidationFirewall(config: RouteConfig, srcDir: string, dbName: string): { code: string, topLevel: string } {
    let code = ``;
    let topLevel = ``;

    for (const [field, mapping] of Object.entries(config.parameters)) {
      if (!mapping) continue;

      const dotIndex = (mapping as string).indexOf('.');
      const table = (mapping as string).substring(0, dotIndex);
      const column = (mapping as string).substring(dotIndex + 1);
      const schemaFile = [
        join(srcDir, "schema", dbName, table, `${column}.ts`),
        join(srcDir, "schema", dbName, table, `${column}.js`)
      ].find(existsSync);

      if (schemaFile) {
        // Read file contents purely as string to extract constraint values without full V8 VM eval (Bare metal extraction)
        const content = readFileSync(schemaFile, 'utf8');
        const minL = content.match(/min_length:\s*\{[^}]*?value:\s*(\d+)/)?.[1];
        const maxL = content.match(/max_length:\s*\{[^}]*?value:\s*(\d+)/)?.[1];
        const req = content.match(/is_optional:\s*\{[^}]*?value:\s*(true|false)/)?.[1];
        
        if (req === 'false') {
          code += `  if (payload.${field} === undefined || payload.${field} === null) {\n`;
          code += `    res.writeHead(422, { "Content-Type": "application/json" });\n`;
          code += `    res.end('{"error":"Validation failed","field":"${field}","rule":"required"}');\n`;
          code += `    return;\n  }\n`;
        }
        if (minL && minL !== '0') {
          code += `  if (payload.${field} && payload.${field}.length < ${minL}) {\n`;
          code += `    res.writeHead(422, { "Content-Type": "application/json" });\n`;
          code += `    res.end('{"error":"Validation failed","field":"${field}","rule":"min_length"}');\n`;
          code += `    return;\n  }\n`;
        }
        if (maxL) {
          code += `  if (payload.${field} && payload.${field}.length > ${maxL}) {\n`;
          code += `    res.writeHead(422, { "Content-Type": "application/json" });\n`;
          code += `    res.end('{"error":"Validation failed","field":"${field}","rule":"max_length"}');\n`;
          code += `    return;\n  }\n`;
        }
      }
    }
    return { code, topLevel };
  }
}
