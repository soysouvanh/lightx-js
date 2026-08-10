/**
 * Business Object - API Ping
 * 
 * This file handles the business logic associated with the "ping" routes. 
 * By default, the `get` method responds to an incoming GET request.
 * 
 * @param {any} payload - The JSON request body (parsed).
 * @returns {Promise<any>} - The structure returned in JSON format to the HTTP client.
 */
export async function get(payload: any) {
  return { message: "Pong!", payload };
}
