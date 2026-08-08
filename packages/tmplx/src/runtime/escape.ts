/**
 * Escape HTML function to prevent XSS (Cross-Site Scripting).
 * @param unsafe Any value to be escaped
 * @returns Escaped HTML string
 */
export function escapeHtml(unsafe: any): string {
  // Omission silencieuse: Zéro allocation UX
  if (unsafe == null) {
    return "";
  }

  // Bypass binaire: esquivant 100% de la vérification Regex
  if (typeof unsafe === "number" || typeof unsafe === "boolean") {
    return "" + unsafe;
  }

  const str = String(unsafe);
  return str.replace(/["&'<>]/g, (match) => {
    switch (match) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return match;
    }
  });
}
