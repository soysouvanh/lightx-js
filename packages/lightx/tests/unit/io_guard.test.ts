import { test, suite } from "node:test";
import * as assert from "node:assert";
import { secureResolve } from "../../src/compiler/io_guard.js";
import { resolve, join } from "node:path";
import { writeFileSync, mkdirSync, rmSync, symlinkSync } from "node:fs";

suite("IO Guard Strict Security Firewall", () => {
  const baseDir = resolve(process.cwd(), "test_sandbox_io");
  const validTarget = "safe_file.txt";
  const outsideTarget = "../outside.txt";

  test("setup environment", () => {
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, validTarget), "safe");
    writeFileSync(join(process.cwd(), "outside.txt"), "hacked");
  });

  test("should resolve a perfectly valid intra-directory path", () => {
    const p = secureResolve(baseDir, validTarget);
    assert.strictEqual(p, resolve(baseDir, validTarget));
  });

  test("should fiercely reject path traversal outside of boundary", () => {
    assert.throws(
      () => secureResolve(baseDir, outsideTarget),
      /Security Violation/
    );
  });

  test("should reject tricky boundary traversal prefix (e.g. test_sandbox_io_hack)", () => {
    const hackedDir = resolve(process.cwd(), "test_sandbox_io_hacked");
    mkdirSync(hackedDir, { recursive: true });
    writeFileSync(join(hackedDir, validTarget), "hacked");
    
    assert.throws(
      () => secureResolve(baseDir, join(hackedDir, validTarget)),
      /Security Violation/
    );

    rmSync(hackedDir, { recursive: true, force: true });
  });

  test("should ruthlessly reject Absolute Path Override (Absolute Injection)", () => {
    assert.throws(
      () => secureResolve(baseDir, "/etc/shadow"),
      /Security Violation|ENOENT/ 
      // realpathSync lèvera ENOENT si absent, ou Security Violation si présent (ex: Mac/Linux file)
    );
  });

  test("should defeat Symlink Bypass (Immunité Tâche 5.2)", () => {
    const symlinkPath = join(baseDir, "trojan_link.txt");
    const outsideReal = join(process.cwd(), "outside.txt");
    
    // On s'assure que le fichier outside.txt existe toujours juste au cas où
    writeFileSync(outsideReal, "hacked");
    symlinkSync(outsideReal, symlinkPath);
    
    assert.throws(
      () => secureResolve(baseDir, "trojan_link.txt"),
      /Security Violation/
    );
  });

  test("cleanup environment", () => {
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(join(process.cwd(), "outside.txt"), { force: true });
  });
});
