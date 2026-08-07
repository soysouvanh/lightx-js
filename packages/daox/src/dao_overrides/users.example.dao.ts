import type { GenericExecutor } from "@soysouvanh/daox";
// You MUST strictly import the generated Row interfaces to perfectly match the original signature:
import type { UsersRow } from "../dao/users.dao.js";

/**
 * Override & Extension definitions for the `users` table.
 */
export class UsersDao {
  /**
   * OVERRIDE EXAMPLE: We hijack the default generated `findById` method
   * to strictly enforce a "Soft Delete" check on every call.
   * Note that the return signature (UsersRow | null) MUST match the original.
   *
   * @param exe The execution engine (connection or transaction)
   * @param pk The Primary Key
   */
  static async findById(exe: GenericExecutor, pk: bigint): Promise<UsersRow | null> {
    const sql =
      "SELECT id, email FROM `users` WHERE `id` = ? AND `is_deleted` = 0 LIMIT 1";
    // Execution uses the native underlying driver to maintain state-of-the-art performance
    const rows = await exe.query<UsersRow>(sql, [pk]);
    return rows[0] ? (rows[0] as UsersRow) : null;
  }

  /**
   * EXTENSION EXAMPLE: Designing a complex business logic method
   * leveraging joins that are often too heavy or subjective to auto-generate.
   *
   * @param exe The execution engine
   * @param roleId Target role ID to map against
   */
  static async findActiveUsersByRole(
    exe: GenericExecutor,
    roleId: number,
  ): Promise<any[]> {
    const sql = `
      SELECT u.id, u.email 
      FROM \`users\` u
      INNER JOIN \`user_roles\` ur ON u.id = ur.user_id
      WHERE ur.role_id = ? 
        AND u.is_active = 1
    `;
    const rows = await exe.query<any>(sql, [roleId]);
    return rows;
  }

  /**
   * EXTENSION EXAMPLE 2: Designing an aggregation (KPI) method.
   * Auto-generated DAOs do not usually include `COUNT`, `SUM`, or `GROUP BY` logic.
   * This extension will be seamlessly appended to the DAO during Compilation.
   *
   * @param exe The execution engine
   */
  static async getUsersKPIs(exe: GenericExecutor): Promise<{ total: number; active: number }> {
    const sql = `
      SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active 
      FROM \`users\`
    `;
    const rows = await exe.query<{ total: number; active: number }>(sql, []);
    return rows[0] ? (rows[0] as { total: number; active: number }) : { total: 0, active: 0 };
  }
}