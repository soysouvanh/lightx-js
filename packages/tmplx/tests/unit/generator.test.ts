import test from "node:test";
import assert from "node:assert";
import { buildTemplateFunction } from "../../src/compiler/generator.ts";
import type { Token } from "../../src/compiler/types.ts";

test("generator correctly transcodes standard structural tokens", () => {
  const staticsMap = new Map<string, number>();
  const tokens: Token[] = [
    { type: "Text", value: "<h1>", line: 1 },
    { type: "PrintSafe", value: "view_data.title", line: 1 },
    { type: "Text", value: "</h1>", line: 1 },
    { type: "Text", value: "<h1>", line: 2 }, // checking deduplication
  ];

  const result = buildTemplateFunction("renderHeading", tokens, staticsMap);

  assert.strictEqual(staticsMap.size, 2);
  assert.strictEqual(staticsMap.get("<h1>"), 0);
  assert.strictEqual(staticsMap.get("</h1><h1>"), 1);

  assert.match(result, /export function renderHeading<T extends Record<string, any>>\(out: Writable, view_data: T\): void/);
  assert.match(result, /out\.write\(_S0\)/);
  assert.match(result, /out\.write\(_S1\)/);
  // It shouldn't emit out.write(_S2) because it was merged
  assert.match(result, /out\.write\(escapeHtml\(view_data\.title\)\)/);
});

test("generator transcodes Script tokens without XSS escaping or quotes", () => {
  const staticsMap = new Map<string, number>();
  const tokens: Token[] = [
    { type: "Script", value: "for (const item of view_data.list) {", line: 1 },
    { type: "Script", value: "if (item.active) {", line: 2 },
    { type: "PrintSafe", value: "item.name", line: 3 },
    { type: "Script", value: "}", line: 4 },
    { type: "Script", value: "}", line: 5 }
  ];

  const result = buildTemplateFunction("renderScript", tokens, staticsMap);
  
  assert.match(result, /for \(const item of view_data\.list\) {/);
  assert.match(result, /if \(item\.active\) {/);
  assert.match(result, /out\.write\(escapeHtml\(item\.name\)\)/);
});

test("generator prevents injection of backticks", () => {
  const staticsMap = new Map<string, number>();
  const tokens: Token[] = [
    { type: "Text", value: "some text with `backticks` and ${injection}", line: 1 },
  ];

  const result = buildTemplateFunction("renderBackticks", tokens, staticsMap);
  
  assert.strictEqual(staticsMap.size, 1);
  
  // Checking that `backticks` are not in the generated TS function body.
  const fnBody = result.slice(result.indexOf("{") + 1, result.lastIndexOf("}"));
  assert.strictEqual(fnBody.includes("`backticks`"), false, "Backticks must not be inline in output TS code");
});
