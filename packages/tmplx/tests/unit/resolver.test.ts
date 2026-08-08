import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveDependencies } from "../../src/compiler/resolver.ts";

test("Resolver: Correctly flattens standard block includes", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "base.html"), "before {% block content %}{% endblock %} after");
  fs.writeFileSync(path.join(tmpDir, "page.html"), "{% extends 'base.html' %}{% block content %}INJECTED{% endblock %}");
  
  const tokens = resolveDependencies(path.join(tmpDir, "page.html"), tmpDir);
  const resultStr = tokens.map(t => t.value).join("");
  
  assert.strictEqual(resultStr, "before INJECTED after");
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Deep include graph building works seamlessly", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "L1.html"), "1 {% include 'L2.html' %} 1");
  fs.writeFileSync(path.join(tmpDir, "L2.html"), "2 {% include 'L3.html' %} 2");
  fs.writeFileSync(path.join(tmpDir, "L3.html"), "3");

  const tokens = resolveDependencies(path.join(tmpDir, "L1.html"), tmpDir);
  const resultStr = tokens.map(t => t.value).join("");
  
  assert.strictEqual(resultStr, "1 2 3 2 1");
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Blocks billion-laughs cyclic include DOS attacks", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "{% include 'B.html' %}");
  fs.writeFileSync(path.join(tmpDir, "B.html"), "{% include 'A.html' %}");

  assert.throws(
    () => resolveDependencies(path.join(tmpDir, "A.html"), tmpDir),
    /SECURITY: Circular dependency detected/
  );
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Enforces MAXIMUM arbitrary inclusion depth bounds", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  
  for (let i = 0; i <= 20; i++) {
    fs.writeFileSync(path.join(tmpDir, `${i}.html`), `{% include '${i + 1}.html' %}`);
  }
  fs.writeFileSync(path.join(tmpDir, "21.html"), "done");

  assert.throws(
    () => resolveDependencies(path.join(tmpDir, "0.html"), tmpDir),
    /SECURITY: Max inclusion depth exceeded \(10\)/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Throws explicit error on unclosed blocks", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "broken.html"), "<div>{% block missing_end %} content </div>");

  assert.throws(
    () => resolveDependencies(path.join(tmpDir, "broken.html"), tmpDir),
    /SYNTAX ERROR: Unclosed block 'missing_end'/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Preserves Blocks within Included files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "{% include 'B.html' %}");
  fs.writeFileSync(path.join(tmpDir, "B.html"), "<div>{% block child %}CHILD{% endblock %}</div>");
  
  const res = resolveDependencies(path.join(tmpDir, "A.html"), tmpDir);
  const resultStr = res.map(t => t.value).join("");
  assert.strictEqual(resultStr, "<div>CHILD</div>");
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Handles Includes inside Blocks perfectly", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "{% block header %}{% include 'B.html' %}{% endblock %}");
  fs.writeFileSync(path.join(tmpDir, "B.html"), "InnerInclude");
  
  const res = resolveDependencies(path.join(tmpDir, "A.html"), tmpDir);
  const resultStr = res.map(t => t.value).join("");
  assert.strictEqual(resultStr, "InnerInclude");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Syntax Rules - Rejects extends inside blocks", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "{% block header %}{% extends 'base.html' %}{% endblock %}");
  assert.throws(() => resolveDependencies(path.join(tmpDir, "A.html"), tmpDir), /'extends' cannot be used inside a block/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Syntax Rules - Rejects multiple extends", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "{% extends 'base.html' %}{% extends 'base2.html' %}");
  assert.throws(() => resolveDependencies(path.join(tmpDir, "A.html"), tmpDir), /Multiple 'extends' directives/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Syntax Rules - Rejects nested blocks within same file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "{% block out %}{% block in %}{% endblock %}{% endblock %}");
  assert.throws(() => resolveDependencies(path.join(tmpDir, "A.html"), tmpDir), /Nested blocks are not allowed/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Syntax Rules - Rejects orphan endblock", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "<div>{% endblock %}</div>");
  assert.throws(() => resolveDependencies(path.join(tmpDir, "A.html"), tmpDir), /'endblock' outside of any block/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Resolver: Syntax Rules - Rejects included files attempting to extend", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmplx-resolver-"));
  fs.writeFileSync(path.join(tmpDir, "A.html"), "{% include 'B.html' %}");
  fs.writeFileSync(path.join(tmpDir, "B.html"), "{% extends 'layout.html' %}");
  assert.throws(() => resolveDependencies(path.join(tmpDir, "A.html"), tmpDir), /Included templates cannot extend layouts/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
