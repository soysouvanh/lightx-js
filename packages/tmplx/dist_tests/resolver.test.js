import {
  secureResolve
} from "./chunk-KT6443RJ.js";
import {
  tokenize
} from "./chunk-NOBLO6B2.js";

// tests/unit/resolver.test.ts
import test from "test";
import assert from "assert";
import fs2 from "fs";
import path2 from "path";
import os from "os";

// src/compiler/resolver.ts
import fs from "fs";
import path from "path";
var MAX_DEPTH = 10;
var MAX_TOTAL_INCLUDES = 200;
function resolveDependencies(entryPath, rootDir) {
  let totalIncludes = 0;
  const cache = /* @__PURE__ */ new Map();
  function processFile(filePath, depth, resolveStack) {
    if (depth > MAX_DEPTH) {
      throw new Error(`SECURITY: Max inclusion depth exceeded (${MAX_DEPTH})`);
    }
    if (totalIncludes > MAX_TOTAL_INCLUDES) {
      throw new Error(`SECURITY: Max total includes exceeded (${MAX_TOTAL_INCLUDES})`);
    }
    const securePath = secureResolve(filePath, rootDir);
    if (resolveStack.has(securePath)) {
      throw new Error(`SECURITY: Circular dependency detected - ${securePath}`);
    }
    resolveStack.add(securePath);
    totalIncludes++;
    const buffer = fs.readFileSync(securePath);
    const rawTokens = tokenize(buffer);
    let extendedPath = null;
    const localTokens = [];
    const blocks = /* @__PURE__ */ new Map();
    let currentBlock = null;
    let blockTokens = [];
    for (const token of rawTokens) {
      if (token.type === "Extends") {
        extendedPath = token.value;
      } else if (token.type === "Block") {
        currentBlock = token.value;
        blockTokens = [];
        localTokens.push({ type: "Block", value: currentBlock, line: token.line });
      } else if (token.type === "EndBlock") {
        if (currentBlock) {
          blocks.set(currentBlock, blockTokens);
          currentBlock = null;
        }
      } else if (currentBlock) {
        blockTokens.push(token);
      } else if (token.type === "Include") {
        const includeRes = processFile(path.join(path.dirname(securePath), token.value), depth + 1, resolveStack);
        localTokens.push(...includeRes.tokens);
      } else {
        localTokens.push(token);
      }
    }
    resolveStack.delete(securePath);
    return { tokens: localTokens, blocks, extends: extendedPath };
  }
  function resolveInheritance(entry) {
    const res = processFile(entry, 0, /* @__PURE__ */ new Set());
    let currentRes = res;
    let currentPath = entry;
    const inheritanceChain = [{ res: currentRes, path: currentPath }];
    while (currentRes.extends) {
      const parentPath = path.join(path.dirname(secureResolve(currentPath, rootDir)), currentRes.extends);
      currentPath = parentPath;
      currentRes = processFile(parentPath, inheritanceChain.length, /* @__PURE__ */ new Set());
      inheritanceChain.push({ res: currentRes, path: currentPath });
    }
    let finalTokens = inheritanceChain[inheritanceChain.length - 1].res.tokens;
    const allKnownBlocks = /* @__PURE__ */ new Map();
    for (let i = inheritanceChain.length - 1; i >= 0; i--) {
      const { res: res2 } = inheritanceChain[i];
      for (const [blockName, tokens] of res2.blocks.entries()) {
        allKnownBlocks.set(blockName, tokens);
      }
    }
    const flatTokens = [];
    function flatten(tokens) {
      for (const token of tokens) {
        if (token.type === "Block") {
          if (allKnownBlocks.has(token.value)) {
            flatten(allKnownBlocks.get(token.value));
          }
        } else {
          flatTokens.push(token);
        }
      }
    }
    if (inheritanceChain.length > 1) {
      flatten(inheritanceChain[inheritanceChain.length - 1].res.tokens);
    } else {
      flatten(inheritanceChain[0].res.tokens);
    }
    return flatTokens;
  }
  return resolveInheritance(entryPath);
}

// tests/unit/resolver.test.ts
test("Resolver: Correctly flattens standard block includes", () => {
  const tmpDir = fs2.mkdtempSync(path2.join(os.tmpdir(), "tmplx-resolver-"));
  fs2.writeFileSync(path2.join(tmpDir, "base.html"), "before {% block content %}{% endblock %} after");
  fs2.writeFileSync(path2.join(tmpDir, "page.html"), "{% extends 'base.html' %}{% block content %}INJECTED{% endblock %}");
  const tokens = resolveDependencies(path2.join(tmpDir, "page.html"), tmpDir);
  const resultStr = tokens.map((t) => t.value).join("");
  assert.strictEqual(resultStr, "before INJECTED after");
  fs2.rmSync(tmpDir, { recursive: true, force: true });
});
test("Resolver: Deep include graph building works seamlessly", () => {
  const tmpDir = fs2.mkdtempSync(path2.join(os.tmpdir(), "tmplx-resolver-"));
  fs2.writeFileSync(path2.join(tmpDir, "L1.html"), "1 {% include 'L2.html' %} 1");
  fs2.writeFileSync(path2.join(tmpDir, "L2.html"), "2 {% include 'L3.html' %} 2");
  fs2.writeFileSync(path2.join(tmpDir, "L3.html"), "3");
  const tokens = resolveDependencies(path2.join(tmpDir, "L1.html"), tmpDir);
  const resultStr = tokens.map((t) => t.value).join("");
  assert.strictEqual(resultStr, "1 2 3 2 1");
  fs2.rmSync(tmpDir, { recursive: true, force: true });
});
test("Resolver: Blocks billion-laughs cyclic include DOS attacks", () => {
  const tmpDir = fs2.mkdtempSync(path2.join(os.tmpdir(), "tmplx-resolver-"));
  fs2.writeFileSync(path2.join(tmpDir, "A.html"), "{% include 'B.html' %}");
  fs2.writeFileSync(path2.join(tmpDir, "B.html"), "{% include 'A.html' %}");
  assert.throws(
    () => resolveDependencies(path2.join(tmpDir, "A.html"), tmpDir),
    /SECURITY: Circular dependency detected/
  );
  fs2.rmSync(tmpDir, { recursive: true, force: true });
});
test("Resolver: Enforces MAXIMUM arbitrary inclusion depth bounds", () => {
  const tmpDir = fs2.mkdtempSync(path2.join(os.tmpdir(), "tmplx-resolver-"));
  for (let i = 0; i <= 20; i++) {
    fs2.writeFileSync(path2.join(tmpDir, `${i}.html`), `{% include '${i + 1}.html' %}`);
  }
  fs2.writeFileSync(path2.join(tmpDir, "21.html"), "done");
  assert.throws(
    () => resolveDependencies(path2.join(tmpDir, "0.html"), tmpDir),
    /SECURITY: Max inclusion depth exceeded \(10\)/
  );
  fs2.rmSync(tmpDir, { recursive: true, force: true });
});
