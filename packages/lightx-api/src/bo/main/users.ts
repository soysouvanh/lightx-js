/**
 * Business Object - Users CRUD
 * Exhaustive pedagogical implementation.
 */

export async function create(payload: any, contexts: any) {
  // const user = await contexts.daox.main.UsersDao.insert(payload);
  return { status: 201, message: "CREATE executed (Example)" };
}

export async function read(payload: any, contexts: any) {
  // const user = await contexts.daox.main.UsersDao.get(payload.id);
  // Or via a dynamic parameter: await contexts.daox.main.UsersDao.getByEmail(payload.email);
  return { status: 200, message: "READ executed (Example)" };
}

export async function update(payload: any, contexts: any) {
  // await contexts.daox.main.UsersDao.updateByPk(payload.id, payload.patch);
  return { status: 200, message: "UPDATE executed (Example)" };
}

export async function remove(payload: any, contexts: any) {
  // await contexts.daox.main.UsersDao.deleteByPk(payload.id);
  return { status: 200, message: "DELETE executed (Example)" };
}

export async function list(payload: any, contexts: any) {
  // const limit = payload.limit || 20;
  // const offset = payload.offset || 0;
  // const users = await contexts.daox.main.UsersDao.listByOffset(limit, offset);
  return { status: 200, users: [], pagination: { limit: 20, offset: 0 } };
}
