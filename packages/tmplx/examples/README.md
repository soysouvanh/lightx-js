# Tmplx: Example execution guide

**Languages:** [English](https://github.com/soysouvanh/lightx-js/blob/main/packages/tmplx/examples/README.md) | [Français](https://github.com/soysouvanh/lightx-js/blob/main/packages/tmplx/examples/README.fr.md)

> **Target audience:** Developers, architects, or enthusiasts.  
> **Goal:** Learn how to bootstrap the `tmplx` AOT engine from scratch and visualize the output stream directly in your web browser.

This folder contains a complete, functional ecosystem to demonstrate inheritance (`extends`), inclusions (`include`), strict XSS-escaping guard routines, and native TypeScript conditioning driven by `@soysouvanh/tmplx`.
Here is the rigorous step-by-step procedure to experience it for yourself.

---

## Step 1: Navigating the environment

**System prerequisite:** Your environment must run **Node.js v22.6.0** (or higher) to natively support the `--experimental-strip-types` flag without requiring external TypeScript execution tools.

Open your computer's terminal at the exact location where you cloned or extracted this project, then navigate to the `tmplx` package folder:

```bash
cd lightx-js/packages/tmplx
npm install
npm run build
```

## Step 2: Igniting the AOT compilation (the build magic)

The "Bare-Metal Zero Flow" philosophy relies on transforming your loose HTML templates (located under `examples/templates`) into native pure TypeScript logic, _long before_ your runtime application even spins up.

Execute the CLI pipeline by typing the following command:

```bash
node bin/tmplx.js build --in examples/templates --out examples/out/tmplx_generated.ts
```

**What exactly happened under the hood?**
The compiler gracefully traversed the folder tree, digested `users/profile.html`, and condensed it into heavily-optimized, statically-allocated Buffer mappings stored within `examples/out/tmplx_generated.ts`.

## Step 3: Triggering the backend simulator (Node streaming)

With the generated TS definitions locked in place, we will simulate how an HTTP backend streams this pre-compiled HTML to a client.
The `examples/main.ts` file replicates this behavior: it consumes mocked data (containing a vicious simulated XSS payload vector), meshes it directly with our newly generated function, and writes the output HTML.

Launch the simulation natively through Node.js:

```bash
node --experimental-strip-types examples/main.ts
```

**If everything executed flawlessly, you will see a message displaying the absolute success path:**

> `HTML file successfully streamed to /your/absolute/path/.../examples/out/profile.html`

## Step 4: Verify the product in a real browser

Your end-target, `profile.html`, is ready for inspection. The final step is to open it in a browser (Chrome, Firefox, Edge, Safari).
Here is the universal and infallible method (no OS-specific command line needed):

1. Take your mouse and **highlight the absolute file path generated in the terminal** output from Step 3 (e.g., `/home/user/lightx.../profile.html` or `C:\Users\...\profile.html`).
2. **Copy** this text.
3. Open a new tab in your favorite web browser.
4. **Paste this path directly into the URL bar at the very top** and press **Enter**.

**Take a minute to right-click and "Inspect the DOM" on the browser:**

- The intended `alert('XSS Hack')` malicious payload you sent was totally sanitized and neutralized into `&lt;script&gt;`.
- The native TS logic loop worked out beautifully, assembling `<li>READ</li>...` with strict DOM compression stripped of any nasty empty white-spaces via the `{%- %}` utility.
- The raw `Bio` (sent with unsafe unescaped `<strong/>` injection intentionally via `{%= %}`) perfectly rendered its formatting.

---

_Congratulations. You have mastered the Zero-Overhead, secure architecture of Tmplx!_
