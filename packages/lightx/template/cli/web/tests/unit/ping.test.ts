import test from "node:test";
import assert from "node:assert";
import { get } from "../../src/bo/example/ping.js";

test("Web Ping BO returns HTML rendering directives", async () => {
  const result = await get({});
  assert.deepStrictEqual(result, { html: true, template: "main/ping/get", data: { message: "Pong!" } });
});
