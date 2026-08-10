import { test, suite } from "node:test";
import * as assert from "node:assert";
import { BareMetalContext } from "../../src/core/context.js";
import type { IncomingMessage, ServerResponse } from "node:http";

suite("Context Engine (Prototype Pollution Immunity)", () => {
  test("payload should be rigorously stripped of Object prototype", () => {
    // Un attaquant envoie un rawPayload forgé avec des __proto__ ou propriétés dangereuses
    const maliciousPayload = JSON.parse('{"__proto__": {"admin": true}, "username": "hack"}');
    
    // Le moteur BareMetal l'encapsule O(1)
    const ctx = new BareMetalContext<any>({} as IncomingMessage, {} as ServerResponse, {}, maliciousPayload);
    
    // Test formel d'immunité : l'objet encapsulé ne peut PAS hériter d'Object
    assert.strictEqual(Object.getPrototypeOf(ctx.payload), null);
    
    // Vérification de la propriété
    assert.strictEqual(ctx.payload.username, "hack");
    
    // Prototype pollution neutered
    assert.strictEqual((ctx.payload as any).admin, undefined);
  });

  test("getDefaultPool should throw Security Violation on missing pools", () => {
    const ctx = new BareMetalContext<any>({} as IncomingMessage, {} as ServerResponse, {}, {});
    assert.throws(() => ctx.getDefaultPool(), /Security\/Config Violation/);
  });

  test("flush() should aggressively close socket with 204 if BO forgot to send data (Anti-DoS)", () => {
    let closedWith204 = false;
    const mockRes = {
      headersSent: false,
      writeHead: (s: number) => { if (s === 204) closedWith204 = true; },
      end: () => {}
    } as any as ServerResponse;

    const ctx = new BareMetalContext<any>({} as IncomingMessage, mockRes, {}, {});
    
    // BO a oublié d'appeler ctx.json()
    ctx.flush();
    
    // Vérification de la coupure de la socket avec succès
    assert.strictEqual(closedWith204, true);
  });
});
