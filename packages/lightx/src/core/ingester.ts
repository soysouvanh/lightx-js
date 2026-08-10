/**
 * Tâche 5.3 : Endiguement anti-DoS (limites payload et parsing)
 * Ce composant gère l'ingestion asynchrone des flux HTTP, avec un bouclier O(1) contre
 * les attaques par Exhaustion de Mémoire (OOM) et de Pile (Maximum call stack size).
 */
import type { IncomingMessage } from "node:http";

export class JsonIngester {
  // Limites SOTA (Modifiables via la configuration AOP si nécessaire, codées en dur pour le "bare-metal" initial)
  static MAX_BODY_SIZE = 1048576; // 1 MB (Strict)
  static MAX_DEPTH = 32;          // Immunité "Maximum call stack size exceeded"

  /**
   * Lit et parse de façon sécurisée le corps de la requête.
   * Lève une exception immédiate au dépassement du ByteBuffer.
   */
  static async parse(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let payloadSize = 0;
      const chunks: Buffer[] = [];

      const onData = (chunk: Buffer) => {
        payloadSize += chunk.length;
        if (payloadSize > JsonIngester.MAX_BODY_SIZE) {
          cleanup();
          req.destroy();
          return reject(new Error("Security Violation: Payload Too Large (Anti-DoS OOM)"));
        }
        chunks.push(chunk);
      };

      const onEnd = () => {
        cleanup();
        if (chunks.length === 0) {
          return resolve({});
        }

        const rawString = Buffer.concat(chunks).toString("utf8");

        try {
          JsonIngester.assertSafeDepth(rawString);
          const parsed = JSON.parse(rawString, (key, value) => {
            if (key === '__proto__' || key === 'constructor') {
              throw new Error("Security Violation: Prototype Pollution payload detected");
            }
            return value;
          });
          resolve(parsed);
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes("Security Violation")) {
            reject(e);
          } else {  
            reject(new Error("Security Violation: Malformed JSON payload"));
          }
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        req.off("data", onData);
        req.off("end", onEnd);
        req.off("error", onError);
      };

      req.on("data", onData);
      req.on("end", onEnd);
      req.on("error", onError);
    });
  }

  /**
   * Scanner O(N) zéro-allocation (stateless loop).
   * Parcourt la structure JSON linéairement pour valider la profondeur maximale 
   * sans provoquer d'effondrement V8. Ignore les caractères à l'intérieur des chaînes de texte.
   */
  static assertSafeDepth(jsonString: string): void {
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    // Boucle O(N) la plus primitive possible pour TurboFan
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];

      if (inString) {
        if (char === '\\' && !isEscaped) {
          isEscaped = true;
        } else if (char === '"' && !isEscaped) {
          inString = false;
        } else {
          isEscaped = false; // Réinitialise l'échappement dès le char suivant
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        depth++;
        if (depth > JsonIngester.MAX_DEPTH) {
          throw new Error("Security Violation: JSON payload depth exceeds safe limits (Anti-DoS Stack Exhaustion)");
        }
      } else if (char === '}' || char === ']') {
        depth--;
        // En cas de malformation "}}", le depth sera négatif, on s'en fiche, JSON.parse() plantera juste après.
      }
    }
  }
}
