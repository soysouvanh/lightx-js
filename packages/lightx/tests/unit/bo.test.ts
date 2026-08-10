import { test, suite } from "node:test";
import * as assert from "node:assert";
import { executeRaiiBO, BusinessObject } from "../../src/core/bo.js";
import { BareMetalContext } from "../../src/core/context.js";
import type { IncomingMessage, ServerResponse } from "node:http";

suite("RAII Business Object Orchestrator", () => {
  test("should seamlessly inject context and transparently execute BO without tx if DB implies it", async () => {
    let touched = false;
    const testBo: BusinessObject<any> = async (ctx) => {
      assert.strictEqual(ctx.payload.hello, "world");
      touched = true;
    };
    
    const mockRes = {
      headersSent: false,
      writeHead: () => {},
      end: () => {}
    } as any as ServerResponse;

    const testCtx = new BareMetalContext(
      {} as IncomingMessage,
      mockRes,
      { MAIN: {} as any },
      { hello: "world" }
    );

    await executeRaiiBO(testCtx, testBo);
    
    assert.strictEqual(touched, true);
  });

  test("should automagically COMMIT if transaction block completes successfully without any try/catch in BO", async () => {
    let commitCount = 0;
    let rollbackCount = 0;
    
    const mockTx = {
      commit: async () => { commitCount++; },
      rollback: async () => { rollbackCount++; }
    };
    
    const txFactoryPool = {
      beginTransaction: async () => mockTx
    };

    const perfectBo: BusinessObject<any> = async (ctx) => {
      // Le dev écrit juste son métier
      assert.strictEqual(ctx.getDefaultPool(), mockTx);
    };

    const mockRes = {
      headersSent: false,
      writeHead: () => {},
      end: () => {}
    } as any as ServerResponse;

    const testCtx = new BareMetalContext(
      {} as IncomingMessage,
      mockRes,
      { MAIN: txFactoryPool as any },
      {}
    );

    await executeRaiiBO(testCtx, perfectBo);

    assert.strictEqual(commitCount, 1);
    assert.strictEqual(rollbackCount, 0);
    
    // Tâche 4.2 Excellence : Preuve mathématique du Zero-State Leak 
    // Le contexte ne maintient plus aucune référence vers la transaction fermée,
    // mais retombe gracieusement sur le pool global.
    assert.strictEqual(testCtx.getDefaultPool(), txFactoryPool as any);
  });

  test("should forcefully ROLLBACK and re-throw on BO catastrophic failure", async () => {
    let commitCount = 0;
    let rollbackCount = 0;
    
    const mockTx = {
      commit: async () => { commitCount++; },
      rollback: async () => { rollbackCount++; }
    };
    
    const txFactoryPool = {
      beginTransaction: async () => mockTx
    };

    const faultyBo: BusinessObject<any> = async () => {
      throw new Error("Mathematical impossible condition hit!");
    };

    const mockRes = {
      headersSent: false,
      writeHead: () => {},
      end: () => {}
    } as any as ServerResponse;

    const testCtx = new BareMetalContext(
      {} as IncomingMessage,
      mockRes,
      { MAIN: txFactoryPool as any },
      {}
    );

    try {
      await executeRaiiBO(testCtx, faultyBo);
      assert.fail("Should have re-thrown the error up to fail-fast router");
    } catch (e: any) {
      assert.strictEqual(e.message, "Mathematical impossible condition hit!");
    }

    assert.strictEqual(commitCount, 0);
    assert.strictEqual(rollbackCount, 1); // Strict RAII Guarantee
  });

  test("should gracefully execute naked BO when NO database pool is configured at all (hasDefaultPool = false)", async () => {
    let touched = false;
    const testBo: BusinessObject<any> = (ctx) => {
      assert.strictEqual(ctx.payload.x, 42);
      touched = true;
    };
    
    // Zéro pools configurés
    const mockRes = { headersSent: false, writeHead: () => {}, end: () => {} } as any as ServerResponse;
    const testCtx = new BareMetalContext({} as IncomingMessage, mockRes, {}, { x: 42 });

    await executeRaiiBO(testCtx, testBo);
    assert.strictEqual(touched, true);
  });

  test("should prioritize and throw original BO error even if infrastructure ROLLBACK drops the connection", async () => {
    const mockTx = {
      commit: async () => {},
      rollback: async () => { throw new Error("Infrastructure TCP Timeout / Connection Dropped during Rollback"); }
    };
    const txFactoryPool = { beginTransaction: async () => mockTx };

    const faultyBo: BusinessObject<any> = async () => {
      throw new Error("Original Business Crash");
    };

    const mockRes = { headersSent: false, writeHead: () => {}, end: () => {} } as any as ServerResponse;
    const testCtx = new BareMetalContext({} as IncomingMessage, mockRes, { MAIN: txFactoryPool as any }, {});

    try {
      await executeRaiiBO(testCtx, faultyBo);
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.strictEqual(e.message, "Original Business Crash"); // Should NOT be the infrastructure error
    }
  });

  test("should trigger ROLLBACK if the COMMIT action itself fails (Atomicity constraints)", async () => {
    let rollbackCount = 0;
    const mockTx = {
      commit: async () => { throw new Error("DB Constraint Violation during Commit"); },
      rollback: async () => { rollbackCount++; }
    };
    const txFactoryPool = { beginTransaction: async () => mockTx };

    const properBo = async () => { /* BO finishes flawlessly */ };

    const mockRes = { headersSent: false, writeHead: () => {}, end: () => {} } as any as ServerResponse;
    const testCtx = new BareMetalContext({} as IncomingMessage, mockRes, { MAIN: txFactoryPool as any }, {});

    try {
      await executeRaiiBO(testCtx, properBo);
      assert.fail("Commit failure should propagate");
    } catch (e: any) {
      assert.strictEqual(e.message, "DB Constraint Violation during Commit");
    }

    assert.strictEqual(rollbackCount, 1);
  });

  test("should NOT trigger ghost ROLLBACK if the HTTP socket flush() crashes after a successful COMMIT", async () => {
    let rollbackCount = 0;
    const mockTx = {
      commit: async () => {}, // Commit succeeds
      rollback: async () => { rollbackCount++; }
    };
    const txFactoryPool = { beginTransaction: async () => mockTx };

    // BO réussi, prépare la donnée
    const successfulBo: BusinessObject<any> = async (ctx) => {
      ctx.json(200, { data: "success" });
    };

    // La socket explose au moment du flush()
    const mockResDead = {
      headersSent: false,
      writeHead: () => { throw new Error("ERR_STREAM_DESTROYED"); },
      end: () => {}
    } as any as ServerResponse;

    const testCtx = new BareMetalContext({} as IncomingMessage, mockResDead, { MAIN: txFactoryPool as any }, {});

    try {
      await executeRaiiBO(testCtx, successfulBo);
      assert.fail("Should throw tcp error");
    } catch (e: any) {
      assert.strictEqual(e.message, "ERR_STREAM_DESTROYED");
    }

    // Le ghost rollback doit être fermement bloqué 
    assert.strictEqual(rollbackCount, 0);
  });
});
