import { test, suite } from "node:test";
import * as assert from "node:assert";
import { Parser } from "../../src/compiler/parser.js";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

suite("Compiler AOP Parser", () => {
  const cwd = process.cwd();
  const envPath = resolve(cwd, "test_aot.env");
  const tsPath = resolve(cwd, "test_aot.ts");
  const badTsRce = resolve(cwd, "test_rce.ts");
  
  const handlersDir = resolve(cwd, "src", "handlers");
  const boDir = resolve(cwd, "src", "bo");
  const autoRouteTs = resolve(handlersDir, "main", "users", "UpdateByIdX.ts");
  const autoBoTs = resolve(boDir, "main", "users.ts");
  const badAutoRouteTs = resolve(handlersDir, "main", "users", "DbDemoPostX.ts");

  test("setup", () => {
    writeFileSync(envPath, "MAIN_DATABASE_URL = postgres://u:p@host/db\n");
    writeFileSync(tsPath, "export const route = { method: 'POST', path: '/user' }; export const parameters = { email: 'users.email' };");
    writeFileSync(badTsRce, "export const route = { method: 'EVAL', path: '/user' };");
    
    mkdirSync(resolve(handlersDir, "main", "users"), { recursive: true });
    mkdirSync(resolve(boDir, "main"), { recursive: true });
    
    const schemaMainUsers = resolve(cwd, "src", "schema", "main", "users");
    mkdirSync(schemaMainUsers, { recursive: true });
    writeFileSync(resolve(schemaMainUsers, "email.ts"), "export default {}");
    
    writeFileSync(autoBoTs, "export function updateByIdX() {}; export function dbDemoPostX() {};");
    writeFileSync(autoRouteTs, "export const route = { method: 'PUT' }; export const parameters = { email: 'users.email', accept_terms: '' };");
    writeFileSync(badAutoRouteTs, "export const route = { method: 'POST' }; export const parameters = { fake: 'users.ghost' };");
  });

  test("parseEnv should dynamically capture DATABASE_URLs in O(1)", () => {
    const pools = Parser.parseEnv(envPath);
    assert.deepStrictEqual(pools, { MAIN: "postgres://u:p@host/db" });
  });

  test("parseHandlerTS should parse strict conforming schemas and parameters", async () => {
    const cfg = await Parser.parseHandlerTS(tsPath);
    assert.strictEqual(cfg.method, "POST");
    assert.strictEqual(cfg.path, "/user");
    assert.strictEqual(cfg.parameters.email, "users.email");
  });

  test("parseHandlerTS should ruthlessly reject hostile method names (RCE/Protocol Smuggling)", async () => {
    await assert.rejects(() => Parser.parseHandlerTS(badTsRce), /Security Violation/);
  });

  test("parseHandlerTS should deduce path dynamically and validate parameters against schema", async () => {
    const cfg = await Parser.parseHandlerTS(autoRouteTs, "main/users/UpdateByIdX.ts");
    assert.strictEqual(cfg.path, "/main/users/update-by-id-x");
    assert.strictEqual(cfg.businessObjects.length, 1);
    assert.strictEqual(cfg.businessObjects[0], "./src/bo/main/users.js::updateByIdX");
    assert.strictEqual(cfg.parameters.email, "users.email");
    assert.strictEqual(cfg.parameters.accept_terms, "");
  });

  test("parseHandlerTS should strictly throw Build Error if parameter mapping column does not exist in schema", async () => {
    await assert.rejects(() => Parser.parseHandlerTS(badAutoRouteTs, "main/users/DbDemoPostX.ts"), /La colonne 'users.ghost' n'existe pas/);
  });

  test("cleanup", () => {
    rmSync(envPath, { force: true });
    rmSync(tsPath, { force: true });
    rmSync(badTsRce, { force: true });
    rmSync(autoRouteTs, { force: true });
    rmSync(badAutoRouteTs, { force: true });
    rmSync(autoBoTs, { force: true });
    rmSync(resolve(cwd, "src", "schema"), { recursive: true, force: true });
  });
});
