import type { UsersCols } from "../../../dao/example/users.dao.js";

/**
 * Routing Configuration - Users UPDATE Handler
 * 
 * Defines the HTTP method and optionally provides the ability to 
 * modify the route path (instead of the generated convention by 
 * default), as well as strict validators and the business pipeline.
 */
export const route = {
  method: "PUT",
  // path: "/example/users/update"
};

/**
 * Expected Parameters (Auto-Validated)
 * 
 * This map binds request payload keys to their respective Database
 * columns. The AOT engine will automatically enforce the corresponding
 * Schema boundaries (max_length, formatting...) defined in the Registry.
 */
// export const parameters: Record<string, UsersCols | ""> = {
//   "id": "users.id",
//   "email": "users.email",
//   "accept_terms": ""
// };

/**
 * Business Object Pipeline (Optional)
 * 
 * Executes one or more Business Objects in sequence. Without declaration,
 * the AOT will automatically link: ./src/bo/example/users.js::update
 */
// export const pipeline = {
//   business_objects: ["./src/bo/example/users.js::update"]
// };
