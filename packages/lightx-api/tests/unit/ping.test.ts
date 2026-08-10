import test from "node:test";
import assert from "node:assert";
import { get } from "../../src/bo/example/ping.js";

test("Ping BO returns valid response", async () => {
  const result = await get({});
  assert.ok(result);
});
