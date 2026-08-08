import test from "node:test";
import assert from "node:assert";
import { escapeHtml } from "../../src/runtime/escape.ts";

test("escapeHtml handles XSS payloads natively", () => {
  assert.strictEqual(escapeHtml("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.strictEqual(escapeHtml(`"&'<>`), "&quot;&amp;&#39;&lt;&gt;");
});

test("escapeHtml short-circuit optimization", () => {
  assert.strictEqual(escapeHtml(null), "");
  assert.strictEqual(escapeHtml(undefined), "");
  assert.strictEqual(escapeHtml(123), "123");
  assert.strictEqual(escapeHtml(true), "true");
  assert.strictEqual(escapeHtml(0), "0");
  assert.strictEqual(escapeHtml(false), "false");
});

test("escapeHtml coerces Objects and Arrays safely", () => {
  assert.strictEqual(escapeHtml([1, 2, "<"]), "1,2,&lt;");
  assert.strictEqual(escapeHtml({ toString: () => "obj<" }), "obj&lt;");
});

test("escapeHtml handles unexpected Symbols gracefully (or throws natively)", () => {
  // String(Symbol) throws TypeError natively when attempting implicit coercion, but String(Symbol()) returns "Symbol()".
  // Note: Since we use `String(unsafe)`, it actually does not throw TypeError on explicit String() cast!
  assert.strictEqual(escapeHtml(Symbol("foo<bar")), "Symbol(foo&lt;bar)");
});

test("escapeHtml resists large strings without ReDoS", () => {
  const largeString = "<".repeat(100000);
  const start = performance.now();
  const escaped = escapeHtml(largeString);
  const end = performance.now();
  assert.strictEqual(escaped.length, 400000);
  assert.ok(end - start < 50, "Regex took too long, vulnerable to ReDoS");
});
