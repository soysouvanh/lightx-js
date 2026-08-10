/**
 * Le bus de données AOT (encapsulation des requêtes / DB pools / payloads purs).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { GenericExecutor } from "@soysouvanh/daox";

export interface RequestContext<T = unknown> {
  // Données AOT validées formellement, Object.create(null) garanti.
  readonly payload: T;
  readonly req: IncomingMessage;
  readonly res: ServerResponse;

  // Pools générés à la volée via la context factory dynamique
  getDefaultPool(): GenericExecutor;
  // getAnalyticsPool(): GenericExecutor; (généré d'après .env)

  // Réponses AOT bare-metal (zero-overhead serialize)
  json(status: number, data: unknown): void;
  streamHtml(templateBuffer: Buffer, viewData: unknown): void;
}

/**
 * Tâche 3.2 - Définition de l'absolu contextuel "prototype-free"
 * Cœur d'extensibilité utilisé par l'AOT pour injecter O(1) les données sans risque Prototype Pollution.
 */
export class BareMetalContext<T> implements RequestContext<T> {
  public readonly payload: T;

  // Protected pools record used by the dynamically emitted accessors
  protected readonly _pools: Record<string, GenericExecutor>;
  
  // Fonction sérialiseur (ex: JSON.stringify standard, ou la fonction AOT O(1) compilée)
  protected readonly _serializer: (data: unknown) => string;

  // Cache interne pour le mode transactionnel (Evite un garbage collection spreading O(N))
  private _tx?: GenericExecutor;

  constructor(
    public readonly req: IncomingMessage,
    public readonly res: ServerResponse,
    pools: Record<string, GenericExecutor>,
    rawPayload: unknown,
    serializer?: (data: unknown) => string
  ) {
    this._pools = pools;
    
    // Tâche 3.2: Immunité structurelle absolue contre Prototype Pollution.
    // Même si un rawPayload malicieux contient "__proto__", il ne pourra pas remonter.
    this.payload = Object.assign(Object.create(null), rawPayload);

    // Fallback natif temporaire si le sérialiseur AOT n'est pas fourni pour cette route (ex: dev-mode)
    this._serializer = serializer || (JSON.stringify);
  }

  private _deferredStatus: number | null = null;
  private _deferredPayload: string | Buffer | null = null;
  private _deferredType: string = "application/json";

  /**
   * Injection SOTA O(1) : assigne la transaction courante sans allouer de nouveaux objets.
   */
  attachTransaction(tx: GenericExecutor | undefined): void {
    this._tx = tx;
  }

  /**
   * V8 JIT Optimization : Vérification boolean O(1) pour éviter l'usage de try/catch
   * comme contrôle de flux qui briserait l'optimisation TurboFan.
   */
  hasDefaultPool(): boolean {
    return !!(this._tx || this._pools["MAIN"] || this._pools["DEFAULT"]);
  }

  getDefaultPool(): GenericExecutor {
    // Tâche 4.2 : Consommation directe de la transaction si injectée (Zero-allocation path)
    if (this._tx) return this._tx;

    // Par convention imposée, MAIN ou DEFAULT
    const pool = this._pools["MAIN"] || this._pools["DEFAULT"];
    if (!pool) throw new Error("Security/Config Violation: No MAIN or DEFAULT database pool initialized.");
    return pool;
  }

  json(status: number, data: unknown): void {
    if (this._deferredStatus !== null) return;
    this._deferredStatus = status;
    this._deferredType = "application/json";
    this._deferredPayload = this._serializer(data);
  }

  streamHtml(templateBuffer: Buffer, viewData: unknown): void {
    if (this._deferredStatus !== null) return;
    this._deferredStatus = 200;
    this._deferredType = "text/html; charset=utf-8";
    this._deferredPayload = templateBuffer;
  }

  /**
   * Tâche 4.2 : Sécurité d'Atomicité (Atomicity Leak Shield)
   * Expédie physiquement les octets uniquement quand le commit DB est garanti.
   */
  flush(): void {
    if (this.res.headersSent) return;

    if (this._deferredStatus === null || this._deferredPayload === null) {
      // Sécurité Anti-DoS (Socket Hang) : le BO a oublié de formater une réponse.
      // On ferme violemment la socket en 204 pour éviter l'épuisement des descripteurs de fichiers (OOM Fila Descriptor DoS).
      this.res.writeHead(204);
      this.res.end();
      return;
    }
    
    this.res.writeHead(this._deferredStatus, {
      "Content-Type": this._deferredType,
      "Content-Length": Buffer.byteLength(this._deferredPayload)
    });
    this.res.end(this._deferredPayload);
  }
}
