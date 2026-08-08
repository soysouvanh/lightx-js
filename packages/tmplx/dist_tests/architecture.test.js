// tests/unit/architecture.test.ts
import test from "test";
import assert from "assert";
import fs from "fs";
import path from "path";
test("Architecture: Supply Chain Guard - package.json", () => {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const pkgContent = fs.readFileSync(packageJsonPath, "utf8");
  const pkg = JSON.parse(pkgContent);
  assert.strictEqual(pkg.type, "module", "Package must be strictly ESM");
  assert.ok(
    pkg.dependencies === void 0 || Object.keys(pkg.dependencies).length === 0,
    "VULNERABILITY: Supply Chain breached. The engine must have zero dependencies."
  );
  assert.strictEqual(pkg.exports.types, "./dist/index.d.ts", "Types boundary broken");
  assert.strictEqual(pkg.exports.import, "./dist/index.js", "Module boundary broken");
});
test("Architecture: Compiler Guard - tsconfig.json", () => {
  const tsconfigPath = path.resolve(process.cwd(), "tsconfig.json");
  const tscContent = fs.readFileSync(tsconfigPath, "utf8");
  const tsc = JSON.parse(tscContent);
  const opts = tsc.compilerOptions;
  assert.strictEqual(opts.strict, true, "Security flag missing: strict");
  assert.strictEqual(opts.noImplicitAny, true, "Security flag missing: noImplicitAny");
  assert.strictEqual(opts.exactOptionalPropertyTypes, true, "Security flag missing: exactOptionalPropertyTypes");
  assert.strictEqual(opts.isolatedModules, true, "Security flag missing: isolatedModules");
});
