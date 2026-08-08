import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

test("Architecture: Supply Chain Guard - package.json", () => {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const pkgContent = fs.readFileSync(packageJsonPath, "utf8");
  const pkg = JSON.parse(pkgContent);

  assert.strictEqual(pkg.type, "module", "Package must be strictly ESM");
  
  // Zéro dépendance
  assert.ok(pkg.dependencies === undefined || Object.keys(pkg.dependencies).length === 0, 
    "VULNERABILITY: Supply Chain breached. The engine must have zero dependencies.");

  // Module Boundary
  assert.strictEqual(pkg.exports.types, "./dist/index.d.ts", "Types boundary broken");
  assert.strictEqual(pkg.exports.import, "./dist/index.js", "Module boundary broken");
});

test("Architecture: Compiler Guard - tsconfig.json", () => {
  const tsconfigPath = path.resolve(process.cwd(), "tsconfig.json");
  const tscContent = fs.readFileSync(tsconfigPath, "utf8");
  // We parse roughly (JSON.parse will fail if there are comments but our file is clean)
  const tsc = JSON.parse(tscContent);

  const opts = tsc.compilerOptions;
  assert.strictEqual(opts.strict, true, "Security flag missing: strict");
  assert.strictEqual(opts.noImplicitAny, true, "Security flag missing: noImplicitAny");
  assert.strictEqual(opts.exactOptionalPropertyTypes, true, "Security flag missing: exactOptionalPropertyTypes");
  assert.strictEqual(opts.isolatedModules, true, "Security flag missing: isolatedModules");
});
