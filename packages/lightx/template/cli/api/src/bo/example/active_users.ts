/**
 * Business Object - Active_users CRUD
 * Exhaustive pedagogical implementation.
 */
import { Active_usersDao } from "../../dao/example/active_users.dao.js";

// Read Method
export async function read(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  // DAO does not have findById. Using raw query:
  const rows = await exe.query("SELECT * FROM `active_users` LIMIT 1");
  return { status: 200, data: rows[0] || null };
}

// List Method
export async function list(payload: any, contexts: any) {
  const exe = contexts.getExamplePool();
  const limit = payload.limit ? parseInt(payload.limit) : 20;
  const offset = payload.offset ? parseInt(payload.offset) : 0;
  const data = await Active_usersDao.listByOffset(exe, offset, limit);
  return { status: 200, data, pagination: { limit, offset } };
}
