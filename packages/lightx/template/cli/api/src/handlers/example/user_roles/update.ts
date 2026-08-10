/**
 * Routing Configuration - User_roles UPDATE Handler
 * 
 * Defines the HTTP method and optionally provides the ability to 
 * modify the route path (instead of the generated convention by 
 * default), as well as strict validators and the business pipeline.
 */
export const route = {
  method: "PUT",
  // path: "/example/user_roles/update"
};

/**
 * Expected Parameters (Auto-Validated)
 * 
 * This map binds request payload keys to their respective Database
 * columns. The AOT engine will automatically enforce the corresponding
 * Schema boundaries (max_length, formatting...) defined in the Registry.
 */
// export const parameters = {
//   "id": "user_roles.id",
//   "email": "user_roles.email"
// };

/**
 * Business Object Pipeline (Optional)
 * 
 * Executes one or more Business Objects in sequence. Without declaration,
 * the AOT will automatically link: ./src/bo/example/user_roles.js::update
 */
// export const pipeline = {
//   business_objects: ["./src/bo/example/user_roles.js::update"]
// };
