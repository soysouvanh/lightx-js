# Tmplx : Guide d'exécution de la démonstration

> **Public ciblé :** Développeurs, architectes ou curieux.  
> **But :** Apprendre à démarrer le parseur de template AOT `tmplx` depuis zéro et visualiser le rendu final dans un navigateur web.

Ce dossier contient un écosystème fonctionnel complet démontrant l'héritage (`extends`), l'inclusion (`include`), l'échappement XSS, et la logique native TypeScript de `@soysouvanh/tmplx`.
Voici la procédure exacte pas-à-pas pour l'expérimenter vous-même.

---

## Étape 1 : Se positionner dans l'environnement

**Prérequis système :** Votre machine doit disposer de **Node.js v22.6.0** (ou supérieur) afin de supporter nativement le flag `--experimental-strip-types` sans aucun outil externe.

Ouvrez le terminal de votre ordinateur à l'emplacement exact où vous avez cloné ou extrait ce projet, puis accédez au dossier du package `tmplx` :

```bash
cd lightx-js/packages/tmplx
npm install
npm run build
```

## Étape 2 : Lancer la compilation AOT (la magie du build)

La philosophie "Bare-Metal Zéro Faille" de Tmplx repose sur la transformation de vos templates HTML (situés dans `examples/templates`) en TypeScript pur natif, _avant même_ que votre application ne démarre.

Lancez le constructeur CLI via la commande suivante :

```bash
node bin/tmplx.js build --in examples/templates --out examples/out/tmplx_generated.ts
```

**Que se passe-t-il techniquement ici ?**
Le constructeur vient de parcourir l'arborescence, a lu `users/profile.html`, et l'a compressé en pointeurs mémoires `Buffer` statiques dans un fichier ultra-optimisé situé sous `examples/out/tmplx_generated.ts`.

## Étape 3 : Exécuter la simulation backend (streaming Node)

Maintenant que le fichier TypeScript est généré, nous devons invoquer le comportement du backend (la simulation d'un serveur HTTP qui transmettrait cette vue).
Le fichier `examples/main.ts` instancie exactement cela : il ingère des données corrompues par XSS, les fusionne au template via la fonction autogénérée, et enregistre le résultat dans un vrai fichier physique.

Exécutez ce script avec Node.js (en activant l'utilisation native des modules TypeScript) :

```bash
node --experimental-strip-types examples/main.ts
```

**Si tout fonctionne, vous verrez apparaître un message affichant le chemin absolu de réussite :**

> `HTML file successfully streamed to /votre/chemin/absolu/.../examples/out/profile.html`

## Étape 4 : Analyser et admirer le résultat dans le navigateur

Votre fichier cible `profile.html` est prêt. La dernière étape consiste à l'ouvrir dans un navigateur (Chrome, Firefox, Edge, Safari).
Voici la méthode infaillible et universelle (sans ligne de commande spécifique à l'OS) :

1. Prenez la souris et **sélectionnez le chemin d'accès absolu fourni par le terminal** à l'Étape 3 (ex: `/home/user/lightx.../profile.html` ou `C:\Users\...\profile.html`).
2. **Copiez** ce texte.
3. Ouvrez un nouvel onglet dans votre navigateur web favori.
4. **Collez ce chemin directement dans la barre d'URL tout en haut** et appuyez sur **Entrée**.

**Prenez le temps d'observer le code source affiché (Clic-droit > Inspecter) :**

- L'attaque `alert('XSS Hack')` qui a été envoyée a été neutralisée avec succès (`&lt;script&gt;`).
- Les éléments TS natifs ont tourné et affichent fièrement vos balises `<li>READ</li>...` sans les sauts de lignes gênants de syntaxe grâce à l'optimisation `{%- %}`.
- La `Bio` avec injection brute HTML (`<strong>`) a conservé son format par l'utilisation volontaire de `{%= %}` (contre la règle standard automatique `{%%= %}`).

---

_Vous voilà familiarisé avec l'architecture Bare-Metal sécurisée de Tmplx !_
