import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { secureResolve } from "../../src/compiler/io_guard.ts";

test("IO Guard: Resolves valid HTML templates", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-"));
  const validFile = path.join(tmpDir, "test.html");
  fs.writeFileSync(validFile, "<div></div>");

  const resolved = secureResolve("test.html", tmpDir);
  assert.strictEqual(resolved, fs.realpathSync(validFile));
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("IO Guard: Throws on missing files", () => {
  assert.throws(
    () => secureResolve("missing.html", process.cwd()),
    /SECURITY: Template not found/
  );
});

test("IO Guard: Prevents Path Traversal absolutely", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-"));
  const subDir = path.join(tmpDir, "templates");
  fs.mkdirSync(subDir);
  
  const secretFile = path.join(tmpDir, "secret.html");
  fs.writeFileSync(secretFile, "secret");

  assert.throws(
    () => secureResolve("../secret.html", subDir),
    /SECURITY: Path Traversal Attempt/
  );
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("IO Guard: Rejects non-HTMLElement file extensions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-"));
  const badFile = path.join(tmpDir, "config.json");
  fs.writeFileSync(badFile, "{}");

  assert.throws(
    () => secureResolve("config.json", tmpDir),
    /SECURITY: Forbidden file extension/
  );
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("IO Guard: Prevents Symlink attacks escaping boundary", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-"));
  const jailDir = path.join(tmpDir, "jail");
  fs.mkdirSync(jailDir);
  
  const passwdFile = path.join(tmpDir, "passwd.html");
  fs.writeFileSync(passwdFile, "root");

  const symlinkFile = path.join(jailDir, "escape.html");
  fs.symlinkSync(passwdFile, symlinkFile);

  assert.throws(
    () => secureResolve("escape.html", jailDir),
    /SECURITY: Path Traversal Attempt/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("IO Guard: Enforces 2MB static size limitation (DoS Guard)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-"));
  const excessiveFile = path.join(tmpDir, "huge.html");
  
  // Create a 2.1 MB file purely in memory-backed tmpfs
  // We use sparse file writing for speed, avoiding real writes.
  const fd = fs.openSync(excessiveFile, 'w');
  fs.writeSync(fd, Buffer.from("a"), 0, 1, 2.5 * 1024 * 1024);
  fs.closeSync(fd);

  assert.throws(
    () => secureResolve("huge.html", tmpDir),
    /SECURITY: File exceeds 2MB limit/
  );
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("IO Guard: Rejects Directories imitating HTML extension", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-"));
  const fakeDir = path.join(tmpDir, "exploit.html");
  fs.mkdirSync(fakeDir);

  assert.throws(
    () => secureResolve("exploit.html", tmpDir),
    /SECURITY: Target is not a file/
  );
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
