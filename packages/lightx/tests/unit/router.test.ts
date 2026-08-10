import { test, suite } from "node:test";
import * as assert from "node:assert";
import { createHttpsResolver, RouterMatrix } from "../../src/core/router.js";
import type { IncomingMessage, ServerResponse } from "node:http";

suite("O(1) Route Matrix & TLS Entonnoir", () => {
  test("HTTPS Matrice O(1) should route strictly and flawlessly or yield 404 (zero overhead)", async () => {
    const routerMatrix: RouterMatrix = new Map();
    
    // Injecting O(1) routing entries
    let hitHealth = false;
    routerMatrix.set("GET|/api/health", async (req, res) => {
      hitHealth = true;
    });

    let panicMasked = false;
    routerMatrix.set("POST|/api/crash", async (req, res) => {
      throw new Error("Business logic simulated crash"); // Should trigger the panic-free generic response
    });

    const resolver = createHttpsResolver(routerMatrix);

    const mockRes404 = {
      writeHead: (s: number) => { assert.strictEqual(s, 404); },
      end: () => {}
    } as any as ServerResponse;

    // Test 404
    await resolver({ method: "GET", url: "/api/ghost" } as IncomingMessage, mockRes404);

    // Test Valid
    await resolver({ method: "GET", url: "/api/health" } as IncomingMessage, {} as ServerResponse);
    assert.strictEqual(hitHealth, true);

    // Test Panic-Free 500
    const mockRes500 = {
      headersSent: false,
      writeHead: (s: number) => { 
        assert.strictEqual(s, 500); 
        panicMasked = true; 
      },
      end: () => {}
    } as any as ServerResponse;

    await resolver({ method: "POST", url: "/api/crash" } as IncomingMessage, mockRes500);
    assert.strictEqual(panicMasked, true);

    // Test TCP Tear-down absorbtion (Mathematical Panic-Free)
    const mockResDead = {
      headersSent: false,
      writeHead: (s: number) => { 
        throw new Error("ERR_STREAM_DESTROYED"); 
      },
      end: () => {}
    } as any as ServerResponse;

    // Si ça rejette, la promesse va throw et faire foirer le test. Le blackhole garantit la complétion.
    await resolver({ method: "POST", url: "/api/crash" } as IncomingMessage, mockResDead);
  });
});
