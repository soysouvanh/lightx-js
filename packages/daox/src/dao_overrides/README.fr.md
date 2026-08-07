# DAO Overrides (Surcharges de DAO)

Bienvenue dans le répertoire des **DAO Overrides** de Daox.

L'architecture de Daox repose sur un principe **"Database-First"** (la base de données fait foi) couplé à une génération de code **AOT (Ahead-Of-Time)** ultra-rapide et performante. Par défaut, Daox génère automatiquement l'ensemble de vos DAO à partir de votre schéma de base de données.

Cependant, il arrive fréquemment que la logique métier requière :

- Des jointures complexes non couvertes par les méthodes standard.
- Des requêtes optimisées spécifiquement pour un cas d'usage (ex: aggrégations, rapports).
- De réécrire ou masquer une méthode générée automatiquement pour en maîtriser finement le comportement.

C'est exactement le rôle du dossier `dao_overrides` !

## Objectif principal

Fournir un mécanisme **fiable, typé et transparent** permettant aux développeurs d'ajouter ou de substituer des méthodes aux DAO auto-générés. Lors de la phase de build, le générateur intelligent de Daox analysera l'AST pour fusionner les méthodes définies ici avec celles générées par défaut ou en injecter de nouvelles, tout en conservant une stricte cohérence architecturale "Bare-Metal".

---

## Comment ça fonctionne ? (Règles d'or)

Pour qu'un _override_ soit valide et pris en compte, vous devez respecter ces règles :

1. **Nommage miroir** : Le nom du fichier DOIT correspondre à la table concernée (ex: `users.dao.ts`), et la classe DOIT avoir exactement le même nom que le DAO ciblé (ex: `UsersDao`).
2. **Méthodes statiques** : Toutes les méthodes doivent être déclarées comme `static`. Daox ne s'instanciant pas à l'exécution pour garantir un "zero-overhead", tout passe par des appels statiques.
3. **Le paramètre `GenericExecutor`** : Le **premier** argument de toute méthode DOIT obligatoirement être un `GenericExecutor` (issu de `@soysouvanh/daox`). C'est lui qui porte le cycle de vie de la connexion ou de la transaction SQL.
4. **Signature Parfaite** : Lors d'une surcharge (override), Daox compare strictement la signature. Le type de retour DOIT matcher le type de retour d'origine. S'il s'agit d'une nouvelle méthode (extension), le type de retour est libre.

---

## Exemple Prêt-à-Copier/Coller

Voici un exemple canonique illustrant comment soit **surcharger** une méthode existante (comme `findById` classique en y ajoutant une sécurité), soit **étendre** le DAO avec une méthode métier complexe.

Créez un fichier `mon_entite.dao.ts` (ex: `users.dao.ts`) :

```typescript
import type { GenericExecutor } from "@soysouvanh/daox";
// Vous DEVEZ impérativement importer les types de Row générés pour que la signature matche parfaitement :
import type { UsersRow } from "../dao/users.dao.js";

/**
 * Surcharge et Extension pour la table `users`.
 */
export class UsersDao {
  /**
   * EXEMPLE DE SURCHARGE : On écrase le `findById` généré par défaut
   * pour obliger à filtrer sur les utilisateurs non-supprimés (Soft Delete).
   * Notez que la signature de retour (UsersRow | null) DOIT correspondre à l'original.
   *
   * @param exe Le moteur d'exécution (connexion ou transaction)
   * @param pk La clé primaire
   */
  static async findById(
    exe: GenericExecutor,
    pk: bigint,
  ): Promise<UsersRow | null> {
    const sql =
      "SELECT id, email FROM `users` WHERE `id` = ? AND `is_deleted` = 0 LIMIT 1";
    // Exécution avec le driver natif pour des performances optimales
    const rows = await exe.query<UsersRow>(sql, [pk]);
    return rows[0] ? (rows[0] as UsersRow) : null;
  }

  /**
   * EXEMPLE D'EXTENSION : Création d'une méthode métier complexe
   * regroupant des jointures, qu'il aurait été lourd de générer automatiquement.
   *
   * @param exe Le moteur d'exécution
   * @param roleId L'identifiant du rôle métier
   */
  static async findActiveUsersByRole(
    exe: GenericExecutor,
    roleId: number,
  ): Promise<any[]> {
    const sql = `
      SELECT u.id, u.email 
      FROM \`users\` u
      INNER JOIN \`user_roles\` ur ON u.id = ur.user_id
      WHERE ur.role_id = ? 
        AND u.is_active = 1
    `;
    const rows = await exe.query<any>(sql, [roleId]);
    return rows;
  }
}
```

## Bonnes Pratiques d'Excellence

- **Performances (SOTA)** : Récupérez uniquement les colonnes dont vous avez besoin (`SELECT id, email` au lieu de `SELECT *`). Daox vise la performance absolue; suivez cette philosophie dans vos surcharges.
- **Sécurité (Injection SQL)** : N'injectez **JAMAIS** de variables directement dans la chaîne SQL via des templates strings (`${maVariable}`). Utilisez TOUJOURS les clauses de protection préparées en tableau `[maVariable]` passées à la méthode `exe.query()`.
- **Minimalisme (YAGNI)** : Ne surchargez que si le DAO auto-généré ne répond pas strictement à votre besoin métier.
