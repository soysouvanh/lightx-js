import { test, suite } from "node:test";
import * as assert from "node:assert";
import { JsonIngester } from "../../src/core/ingester.js";
import { EventEmitter } from "node:events";

suite("JSON Ingestion Firewall (Anti-DoS)", () => {
  
  test("assertSafeDepth should allow normal JSON", () => {
    const validJson = `{"user": {"name": "test", "roles": [1, 2, {"admin": true}]}}`;
    assert.doesNotThrow(() => JsonIngester.assertSafeDepth(validJson));
  });

  test("assertSafeDepth should fiercely reject deeply nested payloads (Stack Exhaustion)", () => {
    // Génération d'une structure malveillante de niveau 35
    let evilJson = '{"a":1}';
    for(let i = 0; i < 35; i++) {
      evilJson = `{"nested": ${evilJson}}`;
    }

    assert.throws(() => JsonIngester.assertSafeDepth(evilJson), /Security Violation: JSON payload depth exceeds safe limits/);
  });

  test("assertSafeDepth should correctly ignore depth characters inside escaped strings", () => {
    // Si l'attaquant tente de camoufler son payload ou si un payload légitime a des caractères {}, le parseur doit ignorer
    const trickyJson = `{"text": "{ [ { [ { \\"fake\\": \\"{}\\" } ] } ] }"}`;
    assert.doesNotThrow(() => JsonIngester.assertSafeDepth(trickyJson));
  });

  test("parse() should ruthlessly reject Prototype Pollution payload vectors including Unicode escapes", async () => {
    const maliciousJson = `{"__proto__": {"admin": true}}`;
    const req1 = new EventEmitter() as any; req1.destroy = () => {};
    const promise1 = JsonIngester.parse(req1);
    req1.emit("data", Buffer.from(maliciousJson));
    req1.emit("end");
    await assert.rejects(promise1, /Security Violation: Prototype Pollution payload detected/);

    const maliciousJson2 = `{"constructor": {"prototype": {"admin": true}}}`;
    const req2 = new EventEmitter() as any; req2.destroy = () => {};
    const promise2 = JsonIngester.parse(req2);
    req2.emit("data", Buffer.from(maliciousJson2));
    req2.emit("end");
    await assert.rejects(promise2, /Security Violation: Prototype Pollution payload detected/);

    // This specifically tests the Unicode bypass vector which defeats naive string scanning
    const maliciousJson3 = `{"\\u005f\\u005fproto\\u005f\\u005f": {"admin": true}}`;
    const req3 = new EventEmitter() as any; req3.destroy = () => {};
    const promise3 = JsonIngester.parse(req3);
    req3.emit("data", Buffer.from(maliciousJson3));
    req3.emit("end");
    await assert.rejects(promise3, /Security Violation: Prototype Pollution payload detected/);
  });

  test("parse() should seamlessly parse a valid stream", async () => {
    const req = new EventEmitter() as any;
    req.destroy = () => {};

    const promise = JsonIngester.parse(req);
    req.emit("data", Buffer.from('{"hello": '));
    req.emit("data", Buffer.from('"world"}'));
    req.emit("end");

    const result = await promise;
    assert.strictEqual(result.hello, "world");
  });

  test("parse() should forcefully disconnect socket if MAX_BODY_SIZE is exceeded (OOM Shield)", async () => {
    const req = new EventEmitter() as any;
    let destroyed = false;
    req.destroy = () => { destroyed = true; };

    const promise = JsonIngester.parse(req);
    
    // On injecte 1.5MB de la data pure
    const hugeChunk = Buffer.alloc(1_500_000, 'x');
    req.emit("data", hugeChunk);

    try {
      await promise;
      assert.fail("Should have thrown Payload Too Large");
    } catch (e: any) {
      assert.match(e.message, /Payload Too Large/);
    }
    
    // Le socket DOIT être détruit physiquement pour libérer la mémoire TCP du kernel linux.
    assert.strictEqual(destroyed, true);
  });
});
