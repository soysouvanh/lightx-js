import test from "node:test";
import assert from "node:assert";
import { tokenize } from "../../src/compiler/tokenizer.ts";

test("Tokenizer: standard HTML text extraction", () => {
  const buf = Buffer.from("<div>Hello</div>", "utf8");
  const tokens = tokenize(buf);
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].type, "Text");
  assert.strictEqual(tokens[0].value, "<div>Hello</div>");
  assert.strictEqual(tokens[0].line, 1);
});

test("Tokenizer: Script token extraction", () => {
  const buf = Buffer.from("<div>{% const a = 1; %}</div>", "utf8");
  const tokens = tokenize(buf);
  assert.strictEqual(tokens.length, 3);
  assert.strictEqual(tokens[1].type, "Script");
  assert.strictEqual(tokens[1].value, "const a = 1;");
});

test("Tokenizer: PrintRaw and PrintSafe extraction", () => {
  const buf = Buffer.from("{%= raw %}  {% %= safe %}", "utf8");
  const tokens = tokenize(buf);
  assert.strictEqual(tokens[0].type, "PrintRaw");
  assert.strictEqual(tokens[0].value, "raw");
  assert.strictEqual(tokens[2].type, "PrintSafe");
  assert.strictEqual(tokens[2].value, "safe");
});

test("Tokenizer: Left Strip {%- optimization", () => {
  const buf = Buffer.from("<div>  \n  {%- block x %}</div>", "utf8");
  const tokens = tokenize(buf);
  // The spaces and newline before {%- must be truncated
  assert.strictEqual(tokens[0].value, "<div>");
  assert.strictEqual(tokens[1].type, "Block");
  assert.strictEqual(tokens[1].value, "x");
});

test("Tokenizer: Right Strip -%} optimization", () => {
  const buf = Buffer.from("{% endblock -%}  \n  </div>", "utf8");
  const tokens = tokenize(buf);
  // The spaces and newline after -%} must be truncated
  assert.strictEqual(tokens[1].value, "</div>");
});

test("Tokenizer: Directives (include, extends, block, endblock) extraction", () => {
  const buf = Buffer.from("{% include 'foo.html' %} {% extends \"base.html\" %}", "utf8");
  const tokens = tokenize(buf);
  assert.strictEqual(tokens[0].type, "Include");
  assert.strictEqual(tokens[0].value, "foo.html"); // Quotations stripped internally
  assert.strictEqual(tokens[2].type, "Extends");
  assert.strictEqual(tokens[2].value, "base.html");
});

test("Tokenizer: Multi-line integrity tracking", () => {
  const buf = Buffer.from("<div>\n{% \n const x = 1; \n %}\n</div>", "utf8");
  const tokens = tokenize(buf);
  assert.strictEqual(tokens[0].line, 1);
  assert.strictEqual(tokens[1].line, 2); // Tag starts at line 2
  assert.strictEqual(tokens[2].line, 4); // Text after tag starts at line 4 (because of \n before %})
});

test("Tokenizer: Throws on unclosed tags", () => {
  const buf = Buffer.from("<div> {% if (x) ", "utf8");
  assert.throws(
    () => tokenize(buf),
    /Syntax Error: Unclosed tag at line 1/
  );
});
