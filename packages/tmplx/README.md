# @soysouvanh/tmplx

> **The "Extreme Bare-Metal" AOT template engine engineered for Node.js and TypeScript.**

<p align="center">
  <img src="https://raw.githubusercontent.com/soysouvanh/lightx-js/main/packages/tmplx/assets/tmplx_architecture_en.svg" alt="Tmplx AOT architecture diagram">
</p>

**Tmplx** redefines server-side rendering (SSR). Instead of reading your HTML files and parsing them repeatedly on every dynamic HTTP request (as Pug, EJS, or Nunjucks do), Tmplx operates as an **AOT (Ahead-Of-Time)** compiler.

It transcodes your HTML logic into static memory buffers (`UTF-8`) hardcoded inside pure native TypeScript.  
**The result?** Zero runtime Regex parsing, Zero dynamic `UTF-16` to `UTF-8` transformations, and aggressive Garbage Collector evasion (OOM bypassing) allowing you to squeeze ultimate capacity from your servers.

---

## Key features and security guardrails

- **Wire-speed execution**: The compiled HTML operates as purely mapped `Uint8Array` chunks written downward physically into the C++ `libuv` loop.
- **Short-circuit security**: Automatic `O(n)` XSS payload neutralization natively embedded inside the token generation.
- **Structural integrity (I/O Guard)**: Mathematical prevention against path traversals and symlink loop escapes. Pre-emptively busts circular dependencies (`Billion Laughs` mitigation).
- **100% Zero-dependency**: Entirely reliant on native `node:*` primitives. Zero node_modules bloating footprint.

---

## Setup and prerequisites

Tmplx weaves gracefully into your environment.  
**System requirement:** To execute our compiled TypeScript on the fly without heavy third-party tooling (like `ts-node`), we leverage standard flags native to **Node.js v22.6.0** (or higher).

```bash
npm install @soysouvanh/tmplx
```

---

## Step-by-step exhaustive manual

This manual explains the structural setup, comprehensive template syntax semantics, and deployment methodologies.

### 1. Architecturing your directory

Designate a root folder containing your HTML files. As an enforced architectural convention, any file (or folder) prefixed by an _underscore_ (`_`) serves as a **private fragment** (like layouts / components) and does **not** leak as an entry-point function.

```text
my-project/
├── templates/
│   ├── _layout.html                  <-- Main wrapper template (private)
│   ├── _components/
│   │   └── user_card.html            <-- Reusable UI snippet (private)
│   └── users/
│       └── profile.html              <-- Requestable entry view (public)
```

### 2. Syntax glossary and usage (with examples)

Tmplx leverages formal delimiter boundaries to bridge logic. Sent values (payload mapping from your Node.js server) are entirely bound inside the `view_data` object in your templates.

#### A. Architecture inheritance (`extends` & `block`)

Formulate a DRY base layout meant to be filled dynamically.
**File `templates/_layout.html`:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>{% block title %}Fallback title{% endblock %}</title>
  </head>
  <body>
    <header><h1>LightX API</h1></header>
    <main>{% block content %}{% endblock %}</main>
  </body>
</html>
```

#### B. Variable interpolation (PrintSafe `XSS` vs PrintRaw)

- `{%%= view_data.myText %}` : Escapes nefarious DOM hijack syntax (>, <, &, ", '). This is the **required default**.
- `{%= view_data.rawHtml %}` : (RAW) Injects unescaped text. Only employ this when absolute trust of the source variable is established internally.

#### C. Pure TypeScript conditioning and inclusions (`include`)

There are **no pseudo-languages** involved here. Within `{% %}` logic boundaries, you write standard TypeScript syntax (like `if` statements or `for...of` loops).
**File `templates/_components/user_card.html`:**

```html
<div class="card">
  <h2>{%%= view_data.user.name %}</h2>

  <!-- Standard TypeScript logical control -->
  {% if (view_data.user.isAdmin) { %}
  <span class="badge">Admin</span>
  {% } %}

  <ul>
    <!-- Using Dash prefix `{%-` to trim layout line-breaks -->
    {%- for (const right of view_data.user.rights) { -%}
    <li>{%%= right %}</li>
    {%- } -%}
  </ul>
</div>
```

#### D. Fusing the root template

Bring the layout together with your modular fragments.
**File `templates/users/profile.html`:**

<!-- prettier-ignore -->
```html
{% extends '../_layout.html' %}

{% block title %}Profile of {%%= view_data.user.name %}{% endblock %}

{% block content %}
<section>
  <!-- Seamless relative inclusion traversal -->
  {% include '../_components/user_card.html' %}
</section>
{% endblock %}
```

---

## 3. AOT compilation sequence (Ahead-Of-Time)

We must process your unoptimized template architecture down into binary-bound native TypeScript files stringently.  
Tmplx delivers a highly specific command-line compiler for this task.

Run this terminal command at your project root:

```bash
npx @soysouvanh/tmplx build --in ./templates --out ./src/tmplx_generated.ts
```

> **CLI breakdown:**
>
> - **`build`** : The directive to instruct HTML pre-rendering.
> - **`--in <dir-path>`** : Connects the scope root of your unstructured views folder.
> - **`--out <file-path>`** : Dictates the output destination (must terminate accurately with `.ts` or `.js`).
>
> _Mechanics:_ The CLI crawls your folder depth. It intentionally skips any folder or file masked by `_`. Once the compiler parses `users/profile.html`, it digests logic, resolves recursive includes, evaluates inheritance paths, and translates the final state into a deterministic exported TypeScript function globally known as: `render_users_profile`.

---

## 4. Deployment stream (production rendering)

Your ultra-light template memory index is securely positioned inside `/src/tmplx_generated.ts`.

Establish a simulated runtime environment `server.ts`:

```typescript
import { createWriteStream } from "node:fs";
// Directly import the compiled static node map
import { render_users_profile } from "./src/tmplx_generated.ts";

// 1. Establish the Writable stream endpoint (like fs stream, or server `res` object)
const outputStream = createWriteStream("./result.html");

// 2. Hydrate the backend logic payload (will map to `view_data` dynamically)
const dataPayload = {
  user: {
    name: "<script>alert('Hacked!')</script> John", // Guard will sanitize this flawlessly
    isAdmin: true,
    rights: ["READ", "WRITE"],
  },
};

// 3. Fire the execution. The encoded Uint8 pointers aggressively flush towards libuv.
render_users_profile(outputStream, dataPayload);
outputStream.end();

console.log("Memory bypassed template rendered!");
```

Boot the Node.js application environment via:

```bash
node --experimental-strip-types server.ts
```

Congratulations. You have offloaded an immense cyclic memory tax related to markup rendering, leaving your system wide-open to maximize cycles toward raw database IO scaling and mission-critical business layers.

---

## Fortification measures

- **Collision safety loop:** Immediately aborts via `Exit Code 1` printing `COLLISION ERROR` if two different template routes mistakenly evaluate toward identical method mappings in TS layout compilation.
- Guard-railed extensively across test domains targeting malicious file resolution loops, path manipulation, and enforcing OOM hardware limitations scaling at barely ~30MB memory imprint threshold traversing 1,000,000 recursive execution loops.
