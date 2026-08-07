# DAO Overrides

**Languages:** [English](./README.md) | [Français](./README.fr.md)

Welcome to the **DAO Overrides** directory for Daox.

Daox's architecture is built strictly on a **"Database-First"** principle, paired with an ultra-fast **AOT (Ahead-Of-Time)** code generation engine. By default, Daox automatically generates all your Data Access Objects (DAOs) directly from your database schema.

However, business logic often requires:

- Complex `INNER/LEFT JOIN` statements not covered by standard CRUD or association methods.
- Highly optimized queries dedicated to a specific edge-case (e.g., aggregations, reporting).
- Rewriting or masking an auto-generated method to tightly control its behavior.

This is exactly what the `dao_overrides` directory was built for!

## Primary Goal

Provide a **reliable, strictly typed, and transparent** pipeline allowing developers to inject custom methods or override auto-generated ones. During the build phase, Daox's intelligent compiler analyzes the AST to merge methods defined here with the default ones or inject new ones, maintaining an absolute "Bare-Metal" architectural cohesion.

---

## How it works (Golden Rules)

For an _override_ to be parsed and injected correctly, you MUST adhere to the following rules:

1. **Mirror Naming**: The filename MUST match the targeted table (e.g., `users.dao.ts`), and the class MUST exactly match the targeted DAO class name (e.g., `UsersDao`).
2. **Static Methods**: All methods must be declared as `static`. Since Daox guarantees a "zero-overhead" runtime and never instantiates objects unnecessarily, everything passes through static calls.
3. **The `GenericExecutor` Parameter**: The **first** argument of _any_ method MUST ALWAYS be a `GenericExecutor` (imported from `@soysouvanh/daox`). This executor strictly manages the connection lifespan or SQL transaction scope.
4. **Perfect Signature**: When overriding, Daox strictly compares the signature. The return type MUST match the original return type. If injecting a new method (extension), the return type is free.

---

## Copy/Paste Example

Here is a canonical example demonstrating how to either **override** an existing generated method (like `findById` to add a security boundary) or **extend** the DAO with complex business logic.

Create a file for your entity (e.g., `users.dao.ts`):

```typescript
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
  static async findById(
    exe: GenericExecutor,
    pk: bigint,
  ): Promise<UsersRow | null> {
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
}
```

## Best Practices for Excellence

- **Performance (SOTA)**: Only fetch the columns you actually need (`SELECT id, email` rather than `SELECT *`). Daox aims for absolute Bare-Metal speed; maintain this philosophy in your overrides.
- **Security (SQL Injections)**: **NEVER** inject variables blindly into a raw SQL string using javascript template literals (`${myVariable}`). ALWAYS use prepared parameter arrays `[myVariable]` passed gracefully into the `exe.query()` method.
- **Minimalism (YAGNI)**: Only write overrides if the auto-generated DAO undeniably fails to serve your business use-case.
