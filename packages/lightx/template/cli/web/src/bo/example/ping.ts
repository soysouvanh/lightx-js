/**
 * Business Object - Web Ping
 * 
 * This file handles the business logic associated with the "ping" web page.
 * By default, the `get` method responds to an incoming GET request
 * with HTML rendering directives via the Tmplx engine.
 * 
 * @param {any} payload - The request body (query string or body).
 * @returns {Promise<any>} - The Tmplx configuration {html, template, data}.
 */
export async function get(payload: any) {
  return { html: true, template: "main/ping/get", data: { message: "Pong!" } };
}
