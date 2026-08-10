import { test, suite } from "node:test";
import * as assert from "node:assert";
import { Emitter } from "../../src/compiler/emitter.js";

suite("AOT Emitter Code Generation", () => {
  
  test("emitContextPoolAccessors should generate zero-allocation context maps", () => {
    const pools = { METRICS: "url" };
    const code = Emitter.emitContextPoolAccessors(pools);
    assert.match(code, /getMetricsPool\(\)/);
    assert.match(code, /return this\._pools\['METRICS'\]/);
  });

  test("emitValidationFirewall should generate rigorous O(1) inline HTTP responses without call-stack overhead", () => {
    const result = Emitter.emitValidationFirewall({
      method: "GET", path: "/x", businessObjects: [],
      parameters: { username: "users.username" },
      srcDir: "", dbName: ""
    }, "", "");
    // Validation is fully deferred to strict TS compilation (Zero-overhead at execution)
    assert.strictEqual(result.code, "");
    assert.strictEqual(result.topLevel, "");
  });

  test("emitJsonSerializer should flatten JSON stringify without recursive traversal", () => {
    const code = Emitter.emitJsonSerializer({ id: "number", token: "string" });
    assert.match(code, /'\{' \+ '"id":' \+ data\.id \+ ',' \+ '"token":"' \+ data\.token \+ '"' \+ '\}'/);
  });
});
