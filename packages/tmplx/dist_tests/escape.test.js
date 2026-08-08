// tests/unit/escape.test.ts
import test from "test";
import assert from "assert";

// src/runtime/escape.ts
function escapeHtml(unsafe) {
  if (unsafe == null) {
    return "";
  }
  if (typeof unsafe === "number" || typeof unsafe === "boolean") {
    return "" + unsafe;
  }
  const str = String(unsafe);
  return str.replace(/["&'<>]/g, (match) => {
    switch (match) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });
}

// tests/unit/escape.test.ts
test("escapeHtml handles XSS payloads natively", () => {
  assert.strictEqual(escapeHtml("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.strictEqual(escapeHtml(`"&'<>`), "&quot;&amp;&#39;&lt;&gt;");
});
test("escapeHtml short-circuit optimization", () => {
  assert.strictEqual(escapeHtml(null), "");
  assert.strictEqual(escapeHtml(void 0), "");
  assert.strictEqual(escapeHtml(123), "123");
  assert.strictEqual(escapeHtml(true), "true");
  assert.strictEqual(escapeHtml(0), "0");
  assert.strictEqual(escapeHtml(false), "false");
});
