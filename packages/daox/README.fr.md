# Daox

**Langues :** [English](https://github.com/soysouvanh/lightx-js/blob/main/packages/daox/README.md) | [Français](https://github.com/soysouvanh/lightx-js/blob/main/packages/daox/README.fr.md)

**Daox** est un ORM **“Bare-Metal” et Database-First** pour Node.js et TypeScript, conçu d'une page blanche pour atteindre des performances pures absolues et un overhead (surcoût) strictement nul.

Contrairement aux ORMs traditionnels qui s'appuient sur une lourde réflexion au runtime et un mapping d'objets complexe (Classes, Decorators, Proxies), Daox opère différemment. Il introspecte votre base de données existante **À l'avance (AOT - Ahead of Time)** et génère un code TypeScript pur, figé, optimisé et statiquement lié.

Forgé pour l'écosystème LightX, Daox passe à l'échelle en toute sécurité, des applications légères aux API transactionnelles à très haute fréquence.

---

## Principes fondamentaux

### Runtime zéro-overhead (piloté par AOT)

Daox supprime la "taxe d'abstraction". Il n'y a absolument aucun parsing de méta-données, aucune réflexion de décorateurs et aucun moteur ORM global qui tourne dans la RAM de votre application. Les fichiers générés par Daox sont en TypeScript natif et invoquent de manière chirurgicale les Drivers SQL C++.

### Sécurité de niveau militaire

Construit pour être impénétrable. Toutes les contraintes de schémas, les identifiants de tables et les paramètres sont structurellement échappés lors du processus de _Build_. Le framework neutralise intégralement les vecteurs de type _Prototype Pollution_, évaluations sauvages, ou Remote Code Execution (RCE) via l'injection de syntaxe. De plus, les liaisons SQL reposent exclusivement sur la paramétrisation native des drivers C++ (Aucune concaténation de chaînes SQL brute).

### Streaming zéro-allocation

Daox opte par défaut pour un streaming natif continu en `AsyncIterable` via une itération par curseurs structurels (`for await (const row of streamer)`). Mathématiquement, cela garantit que la récupération de 10 lignes ou de 2 000 000 de lignes consomme très exactement la même empreinte mémoire finie (O(1)), rendant les plantages OOM (Out Of Memory) virtuellement impossibles.

### Architecture sans-état (injection d'exécuteur)

Le code généré par Daox **ne contient aucune chaîne de connexion ni aucun état global localisé**. Il utilise un pattern strict d'**Injection d'Exécuteur**. Vous instanciez un pool natif (comme `better-sqlite3` ou `postgres`) indépendamment de Daox, puis vous passez explicitement ce pointeur de connexion à vos requêtes. Cela permet de supporter les transactions et l'infrastructure Edge Serverless nativement dès la sortie de la boîte.

---

## Guide de démarrage

### 1. Générez vos DAOs (data access objects)

Daox est _Database-First_. Il a donc besoin d'accéder à une base de données fonctionnelle pour se construire. Il infère automatiquement le moteur depuis l'URL fournie et génère une architecture de fichiers ultra-scalable dans `./src/dao/` par défaut.

```bash
# PostgreSQL
npx @soysouvanh/daox generate --url="postgres://admin:pass@localhost:5432/ma_bdd"

# MySQL / MariaDB
npx @soysouvanh/daox generate --url="mysql://admin:pass@localhost:3306/ma_bdd"

# SQLite
npx @soysouvanh/daox generate --url="sqlite://./playground.db"

# Microsoft SQL Server
npx @soysouvanh/daox generate --url="sqlserver://admin:pass@localhost:1433/ma_bdd"

# Oracle DB
npx @soysouvanh/daox generate --url="oracle://admin:pass@localhost:1521/ma_bdd"
```

### 2. Exploitez l'architecture générée

Votre répertoire `./src/dao/` encapsule désormais nos Iterator TypeScript ultra-stricts fractionnés fichier par fichier, modélisés au millimètre par rapport à votre base.

```typescript
import postgres from "postgres";
import { PostgresExecutor } from "@soysouvanh/daox";
import { UsersDao, User_rolesDao } from "./dao/index.js";

// 1. Initialisez le Driver Natif & Poussez-le dans notre Executor
const sql = postgres("postgres://admin:pass@localhost:5432/ma_bdd");
const exe = new PostgresExecutor(sql);

async function bootstrap() {
  // Insertion Strictement Typée
  const user = await UsersDao.insert(exe, {
    email: "hello@lightx.io",
    status: "active",
  });

  // Streaming Haute-Performance O(1) RAM
  for await (const row of UsersDao.listByCursor(exe, null, 100)) {
    console.log("Itération sans surcharge RAM :", row.email);
  }
}

// 2. Exemple de Transaction Explicite : Isolation Parfaite (Atomicité)
async function securedTransaction() {
  // Pour un contrôle granulaire manuel, on récupère un pointeur de transaction natif
  const txClient = await sql.reserve();
  const txExe = new PostgresExecutor(txClient);

  try {
    await txExe.query("BEGIN"); // Début de la transaction

    const admin = await UsersDao.insert(txExe, {
      email: "admin@sec.com",
      status: "active",
    });
    await User_rolesDao.insert(txExe, {
      user_id: admin.id,
      role_name: "super_admin",
    }); // Action dépendante

    await txExe.query("COMMIT"); // Validation
    console.log("Transaction atomique réussie avec succès.");
  } catch (err) {
    await txExe.query("ROLLBACK"); // Annulation absolue en cas de casse
    console.error("Échec critique couvert, Rollback exécuté :", err);
  } finally {
    txClient.release();
  }
}
```

### 3. Dictionnaire exhaustif de l'API autogénérée

Le moteur Daox applique strictement le concept de **YAGNI** (You Aren't Gonna Need It). L'interface DAO qui sera injectée dépend méticuleusement de la topologie de votre table SQL dans la base de données réelle.

### Méthodes globales (Toujours générées)

Ces méthodes existent pour toutes les tables (et Vues insérables), peu importe leur structure interne.

#### 1. `insert(exe, data)`

Effectue une insertion unitaire stricte, retourne la ligne insérée typée. Omet intelligemment les auto-incréments et timestamps autogénérés des paramètres requis.

```typescript
const user = await UsersDao.insert(exe, {
  email: "hello@lightx.io",
  status: "active",
});
```

#### 2. `insertBatch(exe, items[])`

Exécute une insertion de masse (Bulk) ultra-rapide en générant dynamiquement les descripteurs transactionnels séquentiels pour 1 000 ou 100 000 lignes (`INSERT INTO ... VALUES (), (), ()`).

```typescript
await UsersDao.insertBatch(exe, [
  { email: "a@test.com", status: "active" },
  { email: "b@test.com", status: "suspended" },
]);
```

#### 3. `count(exe)`

Récupère le nombre total exact de lignes actuellement dans la table. Retourne un scalaire entier.

```typescript
const totalUsers = await UsersDao.count(exe);
```

### Méthodes YAGNI (Générées via la Clé Primaire)

Si (et seulement si) la table possède une **Primary Key unique** (ex: `id`), le générateur étend le DAO avec ces méthodes.

#### 4. `findBy[Pk](exe, pk)`

Récupère chirurgicalement un enregistrement par sa clé absolue. Retourne l'entité ou `null`.

```typescript
const user = await UsersDao.findById(exe, 42);
```

#### 5. `existsBy[Pk](exe, pk)`

Effectue une vérification booléenne ultra-légère pour tester l'existence d'un enregistrement par sa Clé Primaire, sans lire les données.

```typescript
const exists = await UsersDao.existsById(exe, 42);
```

#### 6. `updateBy[Pk](exe, pk, patch)`

Met à jour dynamiquement l'enregistrement cible. Il construit une requête `UPDATE ... SET` stricte limitant le trafic réseau localisé au seul payload explicitement fourni.

```typescript
await UsersDao.updateById(exe, 42, { status: "deleted" });
```

#### 7. `deleteBy[Pk](exe, pk)`

Supprime radicalement la ligne ciblée via sa Primary Key absolue.

```typescript
await UsersDao.deleteById(exe, 42);
```

#### 8. `listByCursor(exe, lastCursor, limit)`

Déploie l'itérateur `AsyncIterable` ciblant la clé primaire pour streamer la table des millions de fois avec zéro charge vive (ram) ($O(1)$) via un défilement `WHERE pk > cursor ORDER BY pk ASC`.

```typescript
for await (const row of UsersDao.listByCursor(exe, null, 1000)) {
  console.log(row.id, row.email);
}
```

#### 9. `listByOffset(exe, offset, limit)`

Récupère un lot d'enregistrements via des clauses de saut (Offset Pagination). Typiquement utilisé pour des sauts de page arbitraires sur des datasets contrôlés.

```typescript
const page = await UsersDao.listByOffset(exe, 0, 50);
```

### Méthodes YAGNI Topologiques (Générées via les Index)

Daox introspecte vos index SQL (natifs et clés étrangères). L'interface API épouse mathématiquement les autoroutes de lectures pré-existantes dans votre base de données.

#### 10. `existsBy[Cols](exe, col1, col2)` (Tous les Index)

**(Pour TOUS les index).** Effectue une vérification d'existence ultra-rapide via un index, retournant un booléen sans lire la ligne complète.

```typescript
// Généré parce qu'un index (unique ou non) existe sur votre table
const exists = await UsersDao.existsByEmailAndTenant(exe, "admin@x.com", 1);
```

#### 11. `findBy[Cols](exe, col1, col2)` (Index Unique)

**(Si l'Index de la BDD est UNIQUE).** Exécute un filtre retournant au maximum **une** seule ligne déterministe.

```typescript
// Généré parce qu'un index UNIQUE (email, tenant_id) existe sur votre table
const account = await UsersDao.findByEmailAndTenant(exe, "admin@x.com", 1);
```

#### 12. `findAllBy[Cols](exe, col1, col2)` (Index Classique / Multiples)

**(Si l'Index n'est PAS UNIQUE).** Exécute une extraction optimisée retournant un **tableau** d'entités (ex: un index simple ou une FK).

```typescript
// Généré parce qu'un Index simple (status, role) a été posé sur cette table
const admins = await UsersDao.findAllByStatusAndRole(exe, "active", "admin");
```

#### 13. `countBy[Cols](exe, col1, col2)` (Index Classique / Multiples)

**(Si l'Index n'est PAS UNIQUE).** Compte rapidement le nombre d'enregistrements correspondant aux critères de l'index.

```typescript
const activeAdminsCount = await UsersDao.countByStatusAndRole(
  exe,
  "active",
  "admin",
);
```

### Tests Unitaires Iso-Générés

Lors de la compilation de la codebase, Daox génère strictement un fichier de Test Unitaire isométrique correspondant à la structure exacte de vos classes DAO. Il fournit des environnements de test Jest découplés "out-of-the-box" qui vérifient la logique d'invocation stricte de votre `GenericExecutor`, isolant totalement votre logique de base de données sans aucune écriture manuelle de tests.

**Emplacement des tests générés :**
Les tests sont systématiquement générés directement à côté de vos fichiers DAO (dans le dossier de sortie par défaut : `./src/dao/`).
Par exemple, pour une table nommée `users`, vous trouverez `./src/dao/users.dao.test.ts` généré à côté de `./src/dao/users.dao.ts`.

**Comment les exécuter :**
Puisqu'ils sont strictement typés et découplés, les tests peuvent être exécutés directement via les runners les plus populaires du marché, sans configuration compliquée et sans avoir besoin d'accès BDD :

```bash
# Lancer tous les tests DAO générés via Jest
npx jest src/dao/

# Ou les lancer avec Vitest si vous le préférez
npx vitest run src/dao/
```

---

## Moteurs et compatibilité des drivers natifs

Daox agit comme le chef d'orchestre des drivers C/C++ les plus véloces de Node.js. Pensez à installer le _Driver_ natif désiré (peer-dependency) en fonction du moteur :

| Dialecte SQL           | Préfixe de l'URL           | Package NPM requis (peer dependency) |
| ---------------------- | -------------------------- | ------------------------------------ |
| **PostgreSQL**         | `postgres://`              | `postgres`                           |
| **MySQL / MariaDB**    | `mysql://`                 | `mysql2`                             |
| **SQLite**             | `sqlite://`                | `better-sqlite3`                     |
| **Oracle DB**          | `oracle://`                | `oracledb`                           |
| **SQL Server / MSSQL** | `mssql://`, `sqlserver://` | `mssql`                              |

---

## Concepts avancés

### Gestion des transactions (isolation native)

Grâce au pattern stricte d'**Injection d'Exécuteur**, le mécanisme transactionnel ne provoque aucun overhead dans l'OS. Il suffit de lier la transaction courante à l'aide d'un nouvel Exécuteur local, puis de le passer dynamiquement à vos méthodes.

```typescript
await sql.begin(async (txSql) => {
  // Verrouillage de la Transaction dans l'Exécuteur local
  const txExe = new PostgresExecutor(txSql);

  // Les deux opérations sont désormais atomiques et isolées sans sur-couche ORM !
  const user = await UsersDao.insert(txExe, {
    email: "transaction@lightx.io",
    status: "active",
  });
  await User_rolesDao.insert(txExe, { user_id: user.id, role_name: "guest" });
});
```

### Le concept du YAGNI intégré

(_You Aren't Gonna Need It_). Daox génère rigoureusement l'essentiel. À titre d'exemple : si une Vue (`VIEW`) dans votre BDD ne matérialise pas de clé primaire, Daox se contentera de compiler exclusivement les fonctions de lecture et de streaming en lecture (`listByCursor`), refusant tout bonnement de créer les méthodes `updateById` ou les suppressions arbitraires. La rigidité mathématique du système prime avant tout.

### DAO Overrides (Surcharges métier)

Bien que Daox génère la totalité de vos DAOs, de nombreux cas d'usage nécessitent d'injecter des requêtes métier complexes (ex: INNER JOIN, aggrégations) ou de forcer un comportement précis sur une méthode générée.
Le dossier `src/dao_overrides/` a été créé spécifiquement pour cela. Il vous permet de créer des classes "miroirs" qui viendront remplacer ou étendre les méthodes générées par défaut au moment du _Build AOT_, le tout sans perdre l'intégrité globale du compilateur.

**[Voir la documentation explicative et les exemples prêts à l'emploi des Overrides](./src/dao_overrides/README.fr.md)**

---

## Espace de Tests (Unitaires et Intégration)

Pour garantir sa rigueur paramétrique "Zero-Fail", Daox inclut une batterie de tests complète.

### 1. Tests Unitaires (AOT & Sécurité)

Les tests unitaires vérifient les scanners SQL, la sécurité Anti-SSRF, les protections de Path Traversal, OOM, et les générateurs SOTA.

```bash
npm run test:unit
```

### 2. Tests d'Intégration BDD (Multi-Dialectes)

Les tests d'intégration valident la compilation Daox complète directement contre de réelles bases de données isolées (via Docker Compose).

Assurez-vous qu'une instance Docker est disponible, puis :

```bash
# Lance l'infrastructure Docker (MySQL, Postgres, SQL Server, Oracle)
npm run test:db:up

# Exécute tous les tests d'intégration Bare-Metal sur les 5 drivers
npm run test:integration

# Coupe et nettoie l'infrastructure Docker
npm run test:db:down
```

_(Toutes les connexions aux instances de test, incluant la DB SQLite volatile, sont centralisées architecturalement dans le fichier interne `tests/db_config.ts`)._

---

> Construit de zéro avec une discipline architecturale militaire pour l'**écosystème LightX**.
