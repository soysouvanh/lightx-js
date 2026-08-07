# 📑 Spécification architecturale : création du moteur Daox (@soysouvanh/daox)

## 1. Synthèse stratégique et vision

**Contexte :** Ingénierie fondamentale d'un moteur de base de données `daox` depuis la feuille blanche, conçu spécifiquement pour l'écosystème Node.js / TypeScript.
**Vision et pédagogie :** L'écosystème JavaScript s'appuie massivement sur des ORM (Object-Relational Mappers) lourds, instanciant des classes à l'exécution (runtime) ce qui consomme cycliquement la mémoire et ralentit le CPU (surcoût d'abstraction). Daox prend le contre-pied absolu avec une philosophie **"Bare-Metal"** (proche de la machine).
Le paradigme exclusif est le **"Database-First"** : la source de vérité est la base de données. Daox inspecte la base statiquement et génère un code TypeScript natif de manière anticipée (AOT - Ahead-Of-Time). À l'exécution, l'application ne fait tourner qu'un code SQL pur, parfaitement typé, sans aucune interprétation ou réflexion au runtime.

---

## 2. Règles d'engagement (principes de performance et de sécurité)

Afin de garantir une exécution sans faille, tout développement doit impérativement respecter ces **cinq axiomes** :

- **Règle 1 - Zéro surcoût (Zero-overhead runtime) :** Le code généré ne doit contenir aucune classe statique à instancier (instances mémoires). Il doit produire des requêtes brutes préparées de manière sécurisée (Prepared Statements), gérées directement par les librairies de bas niveau des drivers C/C++ ou réseau (`postgres.js`, `mysql2`, `better-sqlite3`).
- **Règle 2 - Zéro allocation (Streaming intégral) :** Lors de la récupération de millions de lignes, toute instanciation simultanée de tableaux (Arrays) est interdite. La mécanique de lecture doit reposer exclusivement sur le standard `AsyncIterable` pour transmettre la donnée de la socket TCP au format flux continu. Le but est de ne jamais saturer la mémoire vive (Heap Memory), évitant formellement l'arrêt inopiné des processeurs (OOM - Out Of Memory).
- **Règle 3 - La rigueur du code utile (YAGNI) :** Zéro octet de code superflu ne doit être généré. Chaque ligne écrite par le générateur cible une utilité mécanique directe pour l'exécution d'un CRUD (Create, Read, Update, Delete).
- **Règle 4 - Typage absolu :** L'usage du type `any` ou de la primitive `// @ts-ignore` est formellement interdit dans le code cible. Les clés primaires sont typées structurellement selon leur DDL (ex: `pk: number`, `pk: bigint`). Les colonnes JSON sont mappées vers `Record<string, unknown> | unknown[]`. Si un champ du schéma est altéré, le code client doit provoquer intentionnellement une erreur de compilation TypeScript (`tsc`).
- **Règle 5 - Immunité absolue Supply Chain :** Zéro dépendance autorisée dans le bloc `"dependencies"` du package générateur. Les drivers SGBD sont des `peerDependencies` optionnelles. Le code généré (`daox_generated.ts`) ne dépend que du contrat `GenericExecutor` fourni par `@soysouvanh/daox` pour réduire la surface d'attaque Supply Chain à zéro.

---

## 3. Plan d'exécution technique et implémentation stricte

Chaque phase dicte les fichiers exacts à créer, les structures à coder et les contrats à respecter. Aucune liberté architecturale ou d'interprétation n'est permise.

### Phase 1 : Fondation "low-level" et bootstrapping

_Objectif : Installer l'environnement de développement et de build en se coupant des dépendances néfastes de l'écosystème Node._

- [ ] **Tâche 1.1 - Mécanique du module (`package.json`) & Sécurité Supply Chain** :
  - Assainissement radical. Imposer le standard `ECMAScript Modules (ESM)` (`"type": "module"`). Attention (Règle YAGNI stricte) : l'assainissement **ne doit pas** supprimer les métadonnées originelles ni les scripts de tests préexistants.
  - **Immunité absolue Supply Chain :** Zéro dépendance dans `"dependencies"`. Les drivers SGBD sont déclarés en `"peerDependencies"` optionnelles. `tsup` est en `"devDependencies"` uniquement.
  - Verrouillage strict des exports (Module Boundary) par `"exports": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }`.
  - Choix de `tsup` pour compiler le CLI final en un seul fichier (zero-dependency bundle autonome ciblant `bin/daox.js`). Interdiction absolue de créer un fichier `tsup.config.ts` : la configuration doit figurer _exclusivement_ au sein du bloc `"scripts"`.
- [ ] **Tâche 1.2 - Verrouillage déclaratif (`tsconfig.json`)** :
  - Déploiement des marqueurs stricts absolus : `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"isolatedModules": true`.
- [ ] **Tâche 1.3 - Mise en place de l'arborescence structurelle (Fichiers imposés)** :
  - `src/index.ts` : Point d'export unique des runtimes (types publics du générateur).
  - `src/cli/index.ts` : Point d'entrée binaire du générateur.
  - `src/cli/io_guard.ts` : Blindage I/O anti-Path Traversal du fichier de sortie.
  - `src/introspection/types.ts` : Définition structurelle unifiée (DatabaseSchema, TableSchema, etc.).
  - `src/introspection/index.ts` : Moteur de scan (routeur multi-dialecte).
  - `src/introspection/guard.ts` : Endiguement DoS au build.
  - `src/generator/index.ts` : Moteur d'émission (AOT).
  - `src/generator/type_mapper.ts` : Traduction DDL ➡️ TS.
  - `src/generator/dto_builder.ts` : Émetteur d'interfaces.
  - `src/generator/crud_builder.ts` : Émetteur CRUD.
  - `src/generator/advanced_builder.ts` : Émetteur haute-performance.
  - `src/generator/escape.ts` : Immunité SQL Injection (AOT escape).
  - `src/runtime/executor.ts` : Contrat GenericExecutor.
  - `src/runtime/drivers.ts` : Wrappers drivers natifs.

### Phase 2 : Moteur d'introspection (Database-first scanner)

_Objectif : Interroger la base de données pour en soustraire les métadonnées exactes. Les fichiers doivent utiliser des requêtes déterministes._

- [ ] **Tâche 2.1 - Abstraction structurelle unifiée** :
  - Fichier : `src/introspection/types.ts`
  - Contrat explicite obligatoire :
    ```typescript
    export interface DatabaseSchema {
      tables: TableSchema[];
    }
    export interface TableSchema {
      name: string;
      columns: ColumnSchema[];
      primaryKeys: string[];
      indexes: IndexSchema[];
    }
    export interface ColumnSchema {
      name: string;
      sqlType: string;
      typeLocal: string;
      isNullable: boolean;
      hasDefault: boolean;
      isAutoIncrement: boolean;
    }
    export interface IndexSchema {
      name: string;
      columns: string[];
      isUnique: boolean;
    }
    ```
- [ ] **Tâche 2.2 - Implémentation du scanner PostgreSQL** :
  - Fichier : `src/introspection/postgres_scanner.ts`
  - Méthode : `export async function scanPostgres(url: string): Promise<DatabaseSchema>`
  - **Validation de l'URL d'entrée :** Avant toute connexion, l'URL doit être validée via `new URL(url)`. Si le protocole n'est pas `postgres:` ou `postgresql:`, le scanner doit lever une exception immédiate. Zéro transmission d'un chemin de fichier ou d'un script arbitraire au driver.
  - Contrainte : Utilisation stricte de requêtes préparées sur `pg_class`, `pg_attribute` (filtré par `attnum > 0` et `attisdropped = false`) et `information_schema`.
- [ ] **Tâche 2.3 - Implémentation du scanner MySQL** :
  - Fichier : `src/introspection/mysql_scanner.ts`
  - Méthode : `export async function scanMysql(url: string): Promise<DatabaseSchema>`
  - Contrainte : Filtrage précis via `information_schema.columns` (EXTRA = 'auto_increment' mappe vers `isAutoIncrement: true`).
- [ ] **Tâche 2.4 - Implémentation du scanner SQLite** :
  - Fichier : `src/introspection/sqlite_scanner.ts`
  - Méthode : `export async function scanSqlite(filePath: string): Promise<DatabaseSchema>`
  - Contrainte : Exploiter `PRAGMA table_info` et `sqlite_master`.
- [ ] **Tâche 2.5 - Implémentation du scanner Oracle** :
  - Fichier : `src/introspection/oracle_scanner.ts`
  - Méthode : `export async function scanOracle(url: string): Promise<DatabaseSchema>`
  - Contrainte : Requêtage de `ALL_TABLES` et normalisation absolue de la sémantique de casse (majuscule par défaut convertie).
- [ ] **Tâche 2.6 - Implémentation du scanner SQL Server** :
  - Fichier : `src/introspection/sqlserver_scanner.ts`
  - Méthode : `export async function scanSqlServer(url: string): Promise<DatabaseSchema>`
  - Contrainte : Analyse des catalogues `sys.tables` (filtré is_ms_shipped = 0) et `sys.columns`.

### Phase 3 : Moteur de génération de code (AOT emitter)

_Objectif : Retranscrire de façon inaltérable le modèle empirique de la base vers le texte final du fichier `daox_generated.ts`._

- [ ] **Tâche 3.1 - Traduction structurelle stricte (Mapping DDL ➡️ TS)** :
  - Fichier : `src/generator/type_mapper.ts`
  - Méthode : `export function mapSqlTypeToTs(dialect: string, sqlType: string): string`
  - Règle matricielle imposée et inaltérable :
    - Postgres/SQLite/MSSQL `int4`, `integer`, `serial` ➡️ `"number"`
    - Mysql `tinyint(1)`, `boolean`, `bool` ➡️ `"boolean"`
    - Postgres/MySQL `int8`, `bigint`, `bigserial` ➡️ `"bigint"` (Jamais `number` à cause de la faille de limite 2^53-1).
    - Postgres `json`, `jsonb` ➡️ `"Record<string, unknown> | unknown[]"`
    - Type inconnu ➡️ Crash `Error("SECURITY: Unsupported SQL Type <type>")` (Zéro fallback silencieux à `any`).
- [ ] **Tâche 3.2 - Émission des interfaces en flux tendus (DTOs zero-overhead)** :
  - Fichier : `src/generator/dto_builder.ts`
  - Méthode : `export function buildTableInterfaces(table: TableSchema): string`
  - Architecture exacte du livrable :
    ```typescript
    export interface [Entity]Row { [col]: [MappedType]; }
    export type [Entity]Insert = Omit<[Entity]Row, "[AutoIncCol]"> & Partial<Pick<[Entity]Row, "[DefaultCol]">>
    export type [Entity]Patch = Partial<[Entity]Insert>;
    ```
- [ ] **Tâche 3.3 - Constitution des commandes mécaniques CRUD** :
  - Fichier : `src/generator/crud_builder.ts`
  - Méthodes générées requises dans le fichier de sortie TS (le type de la clé primaire `pk` est déduit strictement de la DDL, jamais `any`) :
    - `static async insert(exe: GenericExecutor, data: [Entity]Insert): Promise<[Entity]Row>`
    - `static async updatePartialBy[Pk](exe: GenericExecutor, pk: [PkType], patch: [Entity]Patch): Promise<void>`
    - `static async findBy[Pk](exe: GenericExecutor, pk: [PkType]): Promise<[Entity]Row | null>`
- [ ] **Tâche 3.4 - Implémentation ciblée des hautes performances** :
  - Fichier : `src/generator/advanced_builder.ts`
  - Méthodes générées requises :
    - `static listByCursor(exe: GenericExecutor, lastCursor: [PkType], limit: number): AsyncIterable<[Entity]Row>` (Interdiction formelle de l'usage du mot clé `OFFSET`).
    - `static async insertBatch(exe: GenericExecutor, items: [Entity]Insert[]): Promise<void>` (Requête asynchrone concaténée avec `$1, $2..$N` unique pour bulk-insert atomique).
  - **Règle de sécurité mémoire pour `insertBatch`** : Le générateur doit imposer un découpage automatique en tranches (chunks) respectant le plafond de paramètres du dialecte cible (ex : PostgreSQL `MAX_PARAMS = 65535`). Un batch de 100 000 lignes × 10 colonnes = 1 000 000 paramètres doit être scindé automatiquement en sous-transactions, interdisant l'explosion mémoire du plan de requête préparée.

### Phase 4 : Interface d'exécution (Runtime connector)

_Objectif : Isoler formellement le code généré des drivers SGBD via un contrat strict._

- [ ] **Tâche 4.1 - Isomorphisme des transactions réseau (Isolation des exécuteurs)** :
  - Fichier : `src/runtime/executor.ts` (Exporté nativement par `@soysouvanh/daox`).
  - Signature obligatoire absolue (Contrat) :
    ```typescript
    export interface GenericExecutor {
      query<T>(sql: string, params?: unknown[]): Promise<T[]>;
      stream<T>(sql: string, params?: unknown[]): AsyncIterable<T>;
    }
    ```
- [ ] **Tâche 4.2 - Implémentations Drivers Natifs (Wrappers)** :
  - Fichier : `src/runtime/drivers.ts`
  - La logique d'implémentation d'un wrapper comme `PostgresExecutor` ne doit jamais cloner ou sérialiser les données, elle effectue simplement la redirection : `async *stream<T>(sql, params) { for await (const row of pgClient.query(sql, params).cursor()) { yield row as T; } }`.

### Phase 5 : Architecture de sécurité zéro faille

_Objectif : Assurer l'immunité structurelle de l'outil et du code final._

- [ ] **Tâche 5.1 - Prévention systémique des injections (AOT escape pattern)** :
  - Fichier : `src/generator/escape.ts`
  - Méthode : `export function escapeIdentifier(dialect: string, identifier: string): string;`
  - **Blindage anti-injection de code généré :** L'implémentation doit utiliser des guillemets doubles simples (jamais de template-literals/backticks) et échapper strictement les caractères dangereux pour le dialecte cible :
    ```typescript
    // Postgres : double-quote escaping
    export function escapeIdentifier(
      dialect: string,
      identifier: string,
    ): string {
      if (/[^a-zA-Z0-9_]/.test(identifier)) {
        return '"' + identifier.replace(/"/g, '""') + '"';
      }
      return '"' + identifier + '"';
    }
    ```
  - Règle stricte : Toute construction générant du SQL dans le `crud_builder.ts` **doit** s'enrober d'appels explicites à `escapeIdentifier` pour intégration de la DDL, et interdire la concaténation lors de l'exécution (toujours via argument mappé paramétrique pos : `$1`, ou `?`).
- [ ] **Tâche 5.2 - Endiguement des attaques DoS (Denial of Service) au moment du build** :
  - Fichier : `src/introspection/guard.ts`
  - Méthode : `export function assertMemoryBounds(schema: DatabaseSchema): void;`
  - Règle inaltérable :
    ```typescript
    export function assertMemoryBounds(schema: DatabaseSchema): void {
      if (schema.tables.length > 5000) {
        throw new Error("SECURITY: Schema exceeds table limit (5000)");
      }
      if (schema.tables.some((t) => t.columns.length > 1000)) {
        throw new Error("SECURITY: Table exceeds column limit (1000)");
      }
    }
    ```
- [ ] **Tâche 5.3 - Blindage mécanique I/O de l'outil (Path Traversal, Symlink & Extension Proof)** :
  - Fichier : `src/cli/io_guard.ts`
  - Méthode : `export function validateOutputPath(reqPath: string, rootDir: string): string;`
  - Implémentation incluant résolution symlink, vérification d'existence du répertoire parent, et whitelist d'extension :

    ```typescript
    import path from "node:path";
    import fs from "node:fs";

    const ALLOWED_OUTPUT_EXTENSIONS = new Set([".ts"]);

    export function validateOutputPath(
      reqPath: string,
      rootDir: string,
    ): string {
      const finalOut = path.resolve(rootDir, reqPath);
      const root = fs.realpathSync(rootDir);

      // 1. Clôture géométrique anti-Path Traversal (Symlink-proof)
      const parentDir = path.dirname(finalOut);
      if (!fs.existsSync(parentDir)) {
        throw new Error("SECURITY: Output directory does not exist");
      }
      const realParent = fs.realpathSync(parentDir);
      if (!realParent.startsWith(root + path.sep) && realParent !== root) {
        throw new Error("SECURITY: Path Traversal Attempt");
      }

      // 2. Whitelist d'extension (seul .ts autorisé)
      if (
        !ALLOWED_OUTPUT_EXTENSIONS.has(path.extname(finalOut).toLowerCase())
      ) {
        throw new Error("SECURITY: Output file must have .ts extension");
      }

      return path.join(realParent, path.basename(finalOut));
    }
    ```

- [ ] **Tâche 5.4 - Validation des URL de connexion (Anti-SSRF)** :
  - Avant toute connexion SGBD, chaque scanner doit valider le protocole de l'URL via `new URL(url)`. Les protocoles autorisés sont strictement limités par dialecte : `postgres:`/`postgresql:` pour PostgreSQL, `mysql:` pour MySQL, `mssql:` pour SQL Server. Tout protocole non attendu (ex: `file:`, `javascript:`, `data:`) lève une exception `SECURITY: Invalid database protocol`.

### Phase 6 : Outillage CLI et processus de calibration empirique

_Objectif : Interface utilisateur et tests militaires de validation métrologique._

- [ ] **Tâche 6.1 - Moteur CLI (Daox Engine CLI)** :
  - Fichier : `bin/daox.js`
  - Argument commanditaire imposé : `npx @soysouvanh/daox generate --url="<DB_URL>" --out="./src/daox_generated.ts"`. Invoque le point 5.3 avant d'ouvrir un stream de fichier cible.
- [ ] **Tâche 6.2 - Déploiement de l'infrastructure de tests matriciels (Niveau Militaire)** :
  - Fichiers imposés :
    - `tests/integration/setup/docker-compose.yml` (doit instancier obligatoirement 5 conteneurs : Postgres, MySQL, SQLite, Oracle, MSSQL).
    - `tests/integration/[dialect].test.ts`.
- [ ] **Tâche 6.3 - Sondage métrologique en direct (OOM Validation Militaire)** :
  - Fichier : `tests/integration/memory_profiler.test.ts`
  - Règle stricte et bloquante : Le script de test alloue un pipeline `AsyncIterable` sur `streamAll()` / `listByCursor()` répliquant `1 000 000` de blocs RAM (simulés).
  - Contrôle d'exécution : Ce script doit impérativement s'exécuter sous un **étranglement RAM de V8** commandé par le flag `node --max-old-space-size=64`. L'aboutissement avec succès du test validera formellement la linéarité absolue de l'absence de bufferisation V8.

---

## 4. Livrables systémiques et contrats d'acceptation inaltérables

1. **Délivrable NPM Zéro-Dépendance** : Le bloc `"dependencies"` est vide. Compilation validée dans `dist/` sans avertissement (warning) `tsc`, exports bridés strictement aux interfaces du `GenericExecutor` via `src/index.ts`. Surface d'attaque Supply Chain réduite à zéro.
2. **Artefact AOT Bare-Metal (`daox_generated.ts`)** : Le code de sortie ne dépend d'aucune abstraction, ne résout aucun typage via `any` (clés primaires typées structurellement), n'utilise jamais de template-literals (backticks) dans les constructions SQL, et prouve sa robustesse totale même face au renommage abusif de colonnes SQL.
3. **Sécurité éprouvée formellement** : Le pipeline de tests automatisés doit inclure des cas de sécurité explicites validant : (a) l'immunité SQL Injection via `escapeIdentifier` sur 100% des identifiants, (b) l'immunité Path Traversal y compris via symlinks avec whitelist `.ts`, (c) le rejet des protocoles URL non autorisés (Anti-SSRF), (d) l'absence de crash OOM sous étranglement RAM 64Mo, (e) le plafonnement des paramètres `insertBatch` par dialecte.
