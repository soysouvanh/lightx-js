/**
 * Business Object - Users CRUD
 * Exhaustive pedagogical implementation.
 */
import { UsersDao } from "../../dao/example/users.dao.js";

// Read Method
export async function read(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  const data = await UsersDao.findById(exe, payload.id || payload.code || payload.raw_id);
  if (!data) return { status: 404, message: "Not found" };
  return { status: 200, data };
}

// List Method
export async function list(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  const limit = payload.limit ? parseInt(payload.limit) : 20;
  const offset = payload.offset ? parseInt(payload.offset) : 0;
  const data = await UsersDao.listByOffset(exe, offset, limit);
  return { status: 200, data, pagination: { limit, offset } };
}

// Create Method
export async function create(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  // Using DAO insert
  const data = await UsersDao.insert(exe, payload);
  return { status: 201, message: "CREATE executed", data };
}

// Update Method
export async function update(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  await UsersDao.updateById(exe, payload.id || payload.code || payload.raw_id, payload.patch || payload);
  return { status: 200, message: "UPDATE executed" };
}

// Remove Method
export async function remove(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  await UsersDao.deleteById(exe, payload.id || payload.code || payload.raw_id);
  return { status: 200, message: "DELETE executed" };
}
