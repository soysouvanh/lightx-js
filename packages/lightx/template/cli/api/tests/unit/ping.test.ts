import test from "node:test";
import assert from "node:assert";
import { get } from "../../src/bo/example/ping.js";

test("API Ping BO returns valid JSON response", async () => {
  const payload = { "test": "data" };
  const result = await get(payload);
  assert.deepStrictEqual(result, { message: "Pong!", payload });
});
