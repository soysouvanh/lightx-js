/**
 * Contrat d'interface du routeur AOT (bare-metal) et mécanisme TLS.
 */
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer, ServerOptions } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";

export type RouterMatrix = Map<
  string, // "POST|/api/users"
  (req: IncomingMessage, res: ServerResponse) => Promise<void>
>;

export interface LightXConfig {
  tls: ServerOptions;
  routerMatrix: RouterMatrix;
}

/**
 * Handler O(1) exporté purement pour tester l'isomorphisme mathématique sans EACCES
 */
export function createHttpsResolver(routerMatrix: RouterMatrix) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    // Zéro over-head, on évite le parser URL complet de Node qui tire sur le Garbage Collector
    const url = req.url || "/";
    const path = url.split("?")[0];
    const key = `${req.method}|${path}`;

    const handler = routerMatrix.get(key);
    
    // Filtre 404 instantané mathématique O(1)
    if (!handler) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end('{"error":"Not Found"}');
      return;
    }

    try {
      // Exécution de l'arbre AOP
      await handler(req, res);
    } catch (e: unknown) {
      // Tâche 5.1 : Architecture panic-free (jamais de crash applicatif)
      // On trace l'anomalie côté serveur (sans l'exposer au client)
      console.error(`[AOP Panic Shield] Unhandled exception on route ${key} :`, e instanceof Error ? e.message : String(e));
      try {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end('{"error":"Internal Server Error"}');
        }
      } catch (tcpError) {
        // Blackhole : La socket TCP est déjà détruite par l'attaquant ou le client.
        // Rien ne doit jamais interrompre la boucle V8 (Zéro UnhandledPromiseRejection).
      }
    }
  };
}

/**
 * Tâche 3.1 - Moteur de résolution O(1) et redirecteur TLS
 * Tâche 5.1 - Blindage fail-fast (zéro plantage)
 */
export function startBareMetalServers(config: LightXConfig, testMode = false) {
  // L'entonnoir HTTP 80 (Redirection stricte)
  const httpServer = createHttpServer((req, res) => {
    const host = req.headers.host;
    if (!host) {
      res.writeHead(400).end();
      return;
    }
    const safeHost = host.split(":")[0];
    const targetUrl = `https://${safeHost}${req.url || '/'}`;
    res.writeHead(301, { Location: targetUrl });
    res.end();
  });

  // La matrice infranchissable O(1) HTTPS 443
  const httpsServer = createHttpsServer(config.tls, createHttpsResolver(config.routerMatrix));

  // Les ports normatifs 80 et 443 sont codés en dur, sauf si mode test (CI)
  if (!testMode) {
    httpServer.listen(80);
    httpsServer.listen(443);
  }

  return { httpServer, httpsServer };
}
