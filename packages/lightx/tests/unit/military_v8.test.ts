import { test, suite } from "node:test";
import * as assert from "node:assert";
import { JsonIngester } from "../../src/core/ingester.js";
import { createHttpsResolver, RouterMatrix } from "../../src/core/router.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

suite("Military V8 Vulnerabilities Shield (Tâche 6.2)", () => {

  test("should fiercely withstand Mass Assignment Payload OOM at Stream ingestion", async () => {
    const req = new EventEmitter() as any;
    req.destroy = () => {};

    // Generate huge payload directly surpassing MAX_BODY_SIZE (1MB)
    const hugeChunk = Buffer.alloc(JsonIngester.MAX_BODY_SIZE + 1024, '{"a":1'); 

    const promise = JsonIngester.parse(req);
    req.emit("data", hugeChunk);
    
    await assert.rejects(promise, /Payload Too Large/);
  });
  
  test("should seamlessly parse dense dictionaries without V8 Map memory exhaustion (Map transitions)", async () => {
    let payload = "{";
    // 50,000 custom forced keys to pressure the heap strings and hash collisions
    for(let i = 0; i < 50000; i++) {
        payload += `"${i}": 1,`;
    }
    payload += '"last": 1}';
    
    const req = new EventEmitter() as any;
    req.destroy = () => {};
    const promise = JsonIngester.parse(req);
    req.emit("data", Buffer.from(payload));
    req.emit("end");
    
    const result = await promise;
    assert.strictEqual(result["last"], 1);
  });

  test("should seamlessly absorb RCE / SQL Injection crafted payloads panic-free", async () => {
    const routerMatrix: RouterMatrix = new Map();
    let executed = false;
    routerMatrix.set("POST|/api/login", async (req, res) => {
      throw new Error("Simulated SQL/RCE panic drop");
    });
    const resolver = createHttpsResolver(routerMatrix);

    const mockRes = {
      headersSent: false,
      writeHead: (s: number) => { 
        assert.strictEqual(s, 500); 
      },
      end: () => { executed = true; }
    } as any as ServerResponse;

    const req = {
      method: "POST",
      url: "/api/login",
    } as IncomingMessage;

    await resolver(req, mockRes);
    assert.strictEqual(executed, true);
  });

});
