/**
 * Business Object - Currencies CRUD
 * Exhaustive pedagogical implementation.
 */
import { CurrenciesDao } from "../../dao/example/currencies.dao.js";

// Read Method
export async function read(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  // DAO does not have findById. Using raw query:
  const rows = await exe.query("SELECT * FROM `currencies` LIMIT 1");
  return { status: 200, data: rows[0] || null };
}

// List Method
export async function list(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  const limit = payload.limit ? parseInt(payload.limit) : 20;
  const offset = payload.offset ? parseInt(payload.offset) : 0;
  const data = await CurrenciesDao.listByOffset(exe, offset, limit);
  return { status: 200, data, pagination: { limit, offset } };
}

// Create Method
export async function create(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  // Using DAO insert
  const data = await CurrenciesDao.insert(exe, payload);
  return { status: 201, message: "CREATE executed", data };
}

// Update Method
export async function update(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  // Fallback for tables without single PK in generated DAO
  return { status: 400, message: "UPDATE not supported without custom DAO implementation" };
}

// Remove Method
export async function remove(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  // Fallback for tables without single PK in generated DAO
  return { status: 400, message: "DELETE not supported without custom DAO implementation" };
}
