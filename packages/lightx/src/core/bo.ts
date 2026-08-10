
import type { RequestContext } from "./context.js";
import { BareMetalContext } from "./context.js";
import type { GenericExecutor } from "@soysouvanh/daox";

interface TransactionalPool extends GenericExecutor {
  beginTransaction(): Promise<GenericExecutor & { commit(): Promise<void>; rollback(): Promise<void> }>;
}

function isTransactionalPool(pool: GenericExecutor | null): pool is TransactionalPool {
  return pool !== null && typeof (pool as any).beginTransaction === "function";
}

/**
 * Tâche 4.1 : Contrat d'isomorphisme statique.
 * La fonction métier reste inaltérable (pure), 
 * isolée de la validation HTTP ou des sockets réseau.
 */
export type BusinessObject<T = unknown> = (ctx: RequestContext<T>) => Promise<void> | void;

/**
 * Tâche 4.2 : Gestion RAII native
 * Emballage O(1) de l'appel pure pour initier un contexte de transaction,
 * commit automagiquement, ou rollback silencieusement au moindre effondrement (panic-free).
 */
export async function executeRaiiBO<T>(
  ctx: BareMetalContext<T>,
  bo: BusinessObject<T>
): Promise<void> {

  let pool: GenericExecutor | null = null;
  if (ctx.hasDefaultPool()) {
    pool = ctx.getDefaultPool();
  }

  // Si on est dans un mode mock où la DB ne fait pas de transaction,
  // ou si un pool ne gère pas beginTransaction, on s'adapte en O(1).
  if (!isTransactionalPool(pool)) {
    await bo(ctx);
    ctx.flush();
    return;
  }

  // Cycle strict RAII
  const tx = await pool.beginTransaction();
  
  // Tâche 4.2 Excellence : Injection de la transaction in-place sans `...pools` = Zéro Garbage Collection
  ctx.attachTransaction(tx);

  let committed = false;
  try {
    await bo(ctx);
    await tx.commit();
    committed = true;
    
    // Sécurité Architecturale (Atomicity Leak) : On flush SEULEMENT ici, assurant au client que la 200 OK vaut vraie
    ctx.flush();
  } catch (error) {
    // Aucune fuite d'état (memory/DB pool leak) en cas d'erreur métier
    // Tâche 5.1/4.2 : Sécurité panic-free militaire - on étouffe le crash du rollback
    // s'il y a eu TimeOut réseau pour TOUJOURS jeter l'erreur originale (SOTA RAII).
    if (!committed) {
      try {
        await tx.rollback();
      } catch (infrastructureError) {
        console.error(`[RAII Shield] Infrastructure error during rollback:`, infrastructureError instanceof Error ? infrastructureError.message : String(infrastructureError));
      }
    }
    // Re-jet pour déléguer l'étouffement ultime au pare-feu fail-fast Routeur HTTP (500 json)
    throw error;
  } finally {
    // Tâche 4.2 Excellence (State Clean) : Libérer le pointeur pour le Garbage Collector.
    // Garantit que le contexte ne maintient aucune transaction fermée/détruite.
    ctx.attachTransaction(undefined);
  }
}
