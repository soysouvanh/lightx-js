# LightX Ecosystem

> **"Bare-Metal" engineering for Node.js / TypeScript environments.**

The **LightX** ecosystem is an integrated suite focused on performance, secure-by-design architecture, and TypeScript developer ergonomics. The project relies on **AOT (Ahead-Of-Time)** compilation to build robust and predictable backend interfaces and frontend (SSR) generation.

---

## Framework Components

LightX is structured around three complementary modules:

### 1. Daox: The Reflection-Free "Database-First" ORM

> _Your database is the source of truth._

**Daox** is a data access generation engine. Unlike ORMs that run heavily on dynamic runtime introspection (Reflection), Daox analyzes the database structure during the Build step and outputs native TypeScript _Data Access Objects (DAO)_.

- **Performance (Zero-Allocation)**: No latency logic mapped at runtime. Daox produces raw source code containing pre-generated SQL queries to save CPU processing power.
- **Security**: Embedded protection against SQL injection via forced parameterized queries, and built-in defenses against Out-Of-Memory (OOM) crashes by strictly wiring mandatory pagination logic into the generated interfaces.
- **Productivity**: Autocompletion works straight from the exported schema. Should a table column be altered in the database, the TypeScript compiler will immediately flag syntax conflicts prior to public deployment.

### 2. Tmplx: The AOT Template Engine

> _HTML files statically resolved into pre-compiled network buffers._

**Tmplx** is an SSR rendering engine that converts `.html` files into pure TypeScript functions, removing entirely the need for server-side file reading (I/O) and Abstract Syntax Tree (AST) parsing per HTTP request.

- **"Bare-Metal" Performance**: Static HTML layouts are transformed into **pre-encoded C++ buffers** attached to the global scope. At runtime, V8 pushes these pointers directly down to `libuv`, effectively discarding the traditional and costly dynamic `UTF-16` to `UTF-8` on-the-fly string encoding.
- **Architectural Security**: File paths are strictly resolved during the Build script (precluding Path Traversal vulnerabilities) while automated XSS escaping operates behind a specialized "Short-Circuit" function.
- **Productivity**: Incorporates formal, familiar control block syntaxes like `{% if (...) %}`. The compiler implements complete _Duck-Typing_ constraints which heavily validate that passed layout data types precisely match expected view signatures.

### 3. LightX: The Core Framework

> _Web infrastructure orchestration._

**LightX** natively utilizes `daox` and `tmplx` through a design inspired by Aspect-Oriented Programming (AOP) and Business Objects (BO). This clear partitioning between cross-cutting integrations (routing, security) and business operations allows it to process inbound HTTP requests while keeping the active memory footprint (RAM) purposefully constrained.

---

## Architectural Principles

Technical decisions were made to provide measurable guarantees:

1. **"AOT" (Ahead-Of-Time) approach**: Moving logical resolution overhead from runtime to compile time. Reducing the volume of operations per cycle protects the Garbage Collector's (GC) lifespan and stabilizes the Time-To-First-Byte (TTFB).
2. **Secure by Design**: Avenues of vulnerability are closed conceptually. Examples include the mathematical capping of HTML inclusion depth against "Billion Laughs Attacks", strict limiters on networking I/O, and proven OOM resistance validated under rigid environment testing (capped underneath 32MB of RAM).
3. **Strict Typing (YAGNI)**: The `any` keyword is completely bypassed in the generated logic. Strict end-to-end TypeScript inference ensures data interfaces rigorously behave matching their signatures throughout the software.

---

## Package Ecosystem

Deploy resources matching your designated application structure:

- [**`@soysouvanh/daox`**](./packages/daox/) – Data access and modeling.
- [**`@soysouvanh/tmplx`**](./packages/tmplx/) – HTML engine rendering and agglomeration.
- [**`@soysouvanh/lightx`**](./packages/lightx/) – The minimalist web networking infrastructure router.

_Meticulously designed for extreme performance, security, and productivity._
