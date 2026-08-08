// tests/unit/generator.test.ts
import test from "test";
import assert from "assert";

// src/compiler/generator.ts
function buildTemplateFunction(name, tokens, staticsMap) {
  let fnBody = "";
  const mergedTokens = [];
  for (const token of tokens) {
    if (token.type === "Text" && mergedTokens.length > 0 && mergedTokens[mergedTokens.length - 1].type === "Text") {
      mergedTokens[mergedTokens.length - 1] = {
        ...mergedTokens[mergedTokens.length - 1],
        value: mergedTokens[mergedTokens.length - 1].value + token.value
      };
    } else {
      mergedTokens.push(token);
    }
  }
  for (const token of mergedTokens) {
    if (token.type === "Text") {
      let id = staticsMap.get(token.value);
      if (id === void 0) {
        id = staticsMap.size;
        staticsMap.set(token.value, id);
      }
      fnBody += `      out.write(_S${id});
`;
    } else if (token.type === "PrintSafe") {
      fnBody += `      out.write(escapeHtml(${token.value}));
`;
    } else if (token.type === "PrintRaw") {
      fnBody += `      // XSS-vector warning: Raw print used
      out.write(String(${token.value}));
`;
    } else if (token.type === "Script") {
      fnBody += `      ${token.value}
`;
    } else {
      throw new Error(`INTERNAL ERROR: Unresolved architectural token '${token.type}' reached the Code Emitter.`);
    }
  }
  return `export function ${name}<T extends Record<string, any>>(out: Writable, view_data: T): void {
${fnBody}}
`;
}

// tests/unit/generator.test.ts
test("generator correctly transcodes standard structural tokens", () => {
  const staticsMap = /* @__PURE__ */ new Map();
  const tokens = [
    { type: "Text", value: "<h1>", line: 1 },
    { type: "PrintSafe", value: "view_data.title", line: 1 },
    { type: "Text", value: "</h1>", line: 1 },
    { type: "Text", value: "<h1>", line: 2 }
    // checking deduplication
  ];
  const result = buildTemplateFunction("renderHeading", tokens, staticsMap);
  assert.strictEqual(staticsMap.size, 2);
  assert.strictEqual(staticsMap.get("<h1>"), 0);
  assert.strictEqual(staticsMap.get("</h1><h1>"), 1);
  assert.match(result, /export function renderHeading<T extends Record<string, any>>\(out: Writable, view_data: T\): void/);
  assert.match(result, /out\.write\(_S0\)/);
  assert.match(result, /out\.write\(_S1\)/);
  assert.match(result, /out\.write\(escapeHtml\(view_data\.title\)\)/);
});
test("generator transcodes Script tokens without XSS escaping or quotes", () => {
  const staticsMap = /* @__PURE__ */ new Map();
  const tokens = [
    { type: "Script", value: "if (view_data.x > 5) {", line: 1 },
    { type: "PrintRaw", value: "view_data.html", line: 2 },
    { type: "Script", value: "}", line: 3 }
  ];
  const result = buildTemplateFunction("renderScript", tokens, staticsMap);
  assert.match(result, /if \(view_data\.x > 5\) {/);
  assert.match(result, /out\.write\(String\(view_data\.html\)\)/);
  assert.match(result, /}/);
});
test("generator prevents injection of backticks", () => {
  const staticsMap = /* @__PURE__ */ new Map();
  const tokens = [
    { type: "Text", value: "some text with `backticks` and ${injection}", line: 1 }
  ];
  const result = buildTemplateFunction("renderBackticks", tokens, staticsMap);
  assert.strictEqual(staticsMap.size, 1);
  const fnBody = result.slice(result.indexOf("{") + 1, result.lastIndexOf("}"));
  assert.strictEqual(fnBody.includes("`backticks`"), false, "Backticks must not be inline in output TS code");
});
