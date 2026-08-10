/**
 * Routing Configuration - Order_items REMOVE Handler
 * 
 * Defines the HTTP method and optionally provides the ability to 
 * modify the route path (instead of the generated convention by 
 * default), as well as strict validators and the business pipeline.
 */
export const route = {
  method: "DELETE",
  // path: "/example/order_items/remove"
};

/**
 * Expected Parameters (Auto-Validated)
 * 
 * This map binds request payload keys to their respective Database
 * columns. The AOT engine will automatically enforce the corresponding
 * Schema boundaries (max_length, formatting...) defined in the Registry.
 */
// export const parameters = {
//   "id": "order_items.id",
//   "email": "order_items.email"
// };

/**
 * Business Object Pipeline (Optional)
 * 
 * Executes one or more Business Objects in sequence. Without declaration,
 * the AOT will automatically link: ./src/bo/example/order_items.js::remove
 */
// export const pipeline = {
//   business_objects: ["./src/bo/example/order_items.js::remove"]
// };
