/**
 * Routing Configuration - Ping GET Handler
 * 
 * Defines the HTTP method and optionally provides the ability to 
 * modify the route path (instead of the generated convention by 
 * default), as well as strict validators and the business pipeline.
 */
export const route = {
  method: "GET",
  // path: "/my/custom/path"
};

/**
 * Validation (Optional)
 * 
 * This property allows you to add your data validators or to 
 * override the automatic schema verification constraints.
 */
// export const validation = {
//   overrides: {}
// };

/**
 * Business Object Pipeline (Optional)
 * 
 * Executes one or more Business Objects in sequence. Without declaration,
 * the AOT will automatically link: ./src/bo/main/ping.js::get
 */
// export const pipeline = {
//   business_objects: ["./src/bo/main/ping.js::get"]
// };
