import type { Token } from "./types.ts";

export function buildTemplateFunction(name: string, tokens: Token[], staticsMap: Map<string, number>): string {
  let fnBody = "";
  
  const mergedTokens: Token[] = [];
  for (const token of tokens) {
    if (token.type === "Text" && mergedTokens.length > 0 && mergedTokens[mergedTokens.length - 1].type === "Text") {
      mergedTokens[mergedTokens.length - 1] = { 
        ...mergedTokens[mergedTokens.length - 1], 
        value: mergedTokens[mergedTokens.length - 1].value + token.value 
      };
    } else {
      mergedTokens.push(token);
    }
  }

  for (const token of mergedTokens) {
    if (token.type === "Text") {
      let id = staticsMap.get(token.value);
      if (id === undefined) {
        id = staticsMap.size;
        staticsMap.set(token.value, id);
      }
      fnBody += `      out.write(_S${id});\n`;
    } else if (token.type === "PrintSafe") {
      fnBody += `      out.write(escapeHtml(${token.value}));\n`;
    } else if (token.type === "PrintRaw") {
      fnBody += `      // XSS-vector warning: Raw print used\n      out.write(String(${token.value}));\n`;
    } else if (token.type === "Script") {
      fnBody += `      ${token.value}\n`;
    } else {
      throw new Error(`INTERNAL ERROR: Unresolved architectural token '${token.type}' reached the Code Emitter.`);
    }
  }

  return `export function ${name}<T extends Record<string, any>>(out: Writable, view_data: T): void {\n${fnBody}}\n`;
}
