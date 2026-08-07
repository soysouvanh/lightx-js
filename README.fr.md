# Écosystème LightX

> **L'ingénierie "Bare-Metal" pour les environnements Node.js / TypeScript.**

L'écosystème **LightX** est une suite intégrée axée sur la performance, la sécurité par conception, et l'ergonomie TypeScript. Le projet s'appuie sur la compilation **AOT (Ahead-Of-Time)** pour construire des backends et générer du frontend (SSR) de manière robuste et prédictible.

---

## Les Composants du Framework

LightX est structuré autour de trois composants complémentaires :

### 1. Daox : L'ORM "Database-First" sans Reflection

> _La source de vérité est votre base de données._

**Daox** est un moteur de génération d'accès aux données. Contrairement aux ORM s'appuyant sur l'introspection dynamique au runtime (Reflection), Daox analyse la structure de la base de données au Build, et génère des _Data Access Objects (DAO)_ en TypeScript natif.

- **Performance (Zéro-Allocation)** : Aucun "mapping" au runtime. Daox produit du code source brut, avec des requêtes SQL pré-générées pour limiter l'utilisation du processeur.
- **Sécurité** : Protection contre l'injection SQL par paramétrage forcé des requêtes, et prévention contre les dépassements mémoire (OOM) via des méthodes de pagination forcées incluses dans le code généré.
- **Productivité** : L'autocomplétion est générée à partir du schéma. Si le schéma d'une table change en base, le compilateur TypeScript détecte les incohérences avant tout déploiement public.

### 2. Tmplx : Le Moteur de Template AOT

> _Des fichiers HTML convertis en buffers réseaux pré-compilés._

**Tmplx** est un moteur de rendu (SSR) qui convertit vos fichiers `.html` en fonctions pures TypeScript, supprimant ainsi la lecture de fichiers (I/O) à la volée et l'analyse d'Arbres Syntaxiques (AST) lors du traitement d'une requête HTTP.

- **Performance "Bare-Metal"** : Le HTML statique est transformé en **Buffers C++ pré-encodés** et mis en cache global. À l'exécution, V8 transmet directement les pointeurs à `libuv`, éliminant le surcoût lié à la conversion dynamique `UTF-16` vers `UTF-8`.
- **Sécurité Architecturale** : Résolution statique des chemins au moment du Build (blocage des failles de Path Traversal) et échappement XSS automatisé via une architecture dite "Short-Circuit".
- **Productivité** : Intégration de balises de structures conditionnelles et formelles `{% if (...) %}`. Le compilateur utilise le _Duck-Typing_ pour valider strictement que les données fournies correspondent aux variables attendues par la vue.

### 3. LightX : Le Core Framework

> _L'orchestration de l'infrastructure web._

**LightX** utilise nativement `daox` et `tmplx` en s'appuyant sur une conception inspirée de la Programmation Orientée Aspect (AOP) et des Objets Métier (BO). Cette séparation claire entre logique transversale (routage, sécurité) et opérations métier permet de distribuer les requêtes HTTP tout en maintenant une empreinte mémoire (RAM) strictement restreinte.

---

## Principes Architecturaux

Les choix techniques ont été pris pour apporter des garanties mesurables :

1. **Approche "AOT" (Ahead-Of-Time)** : Déplacer la résolution logique de l'exécution vers le Build. Baisser le nombre d'opérations faites au runtime permet de préserver le cycle de vie du Garbage Collector (GC) et de fiabiliser la latence (TTFB).
2. **"Secure by Design"** : Les failles potentielles sont contournées au niveau conceptuel. Exemples : limitation mathématique de la profondeur d'inclusion HTML contre le "Billion Laughs Attack", limitations strictes d'I/O réseau, et résistance OOM validée par test environnemental (bridage sous 32MB de RAM).
3. **Typage strict (YAGNI)** : Le mot-clé `any` n'est pas émis dans le code généré. L'inférence TypeScript bout-en-bout garantit que les formes des données répondent rigoureusement aux signatures attendues.

---

## L'Écosystème des Packages

Déployez les ressources en fonction de l'application construite :

- [**`@soysouvanh/daox`**](./packages/daox/) – Gestion d'accès aux bases de données.
- [**`@soysouvanh/tmplx`**](./packages/tmplx/) – Moteur d'agglomération et de rendu HTML.
- [**`@soysouvanh/lightx`**](./packages/lightx/) – Le routeur d'infrastructure web minimaliste.

_Conçu méticuleusement pour une performance, sécurité et productivité extrême._
