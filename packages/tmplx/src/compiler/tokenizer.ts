import type { Token, TokenType } from "./types.ts";

export function tokenize(source: Buffer): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  const len = source.length;
  let textStart = 0;

  while (i < len) {
    if (source[i] === 0x7b && source[i + 1] === 0x25) {
      let tagStart = i;
      let isStripLeft = source[i + 2] === 0x2d;
      let contentStart = isStripLeft ? i + 3 : i + 2;

      if (textStart < tagStart) {
        let textEnd = tagStart;
        if (isStripLeft) {
          while (textEnd > textStart && (source[textEnd - 1] === 0x20 || source[textEnd - 1] === 0x09 || source[textEnd - 1] === 0x0a || source[textEnd - 1] === 0x0d)) {
            textEnd--;
          }
        }
        if (textStart < textEnd) {
          tokens.push({ type: "Text", value: source.toString("utf8", textStart, textEnd), line });
        }
      }

      for (let j = textStart; j < tagStart; j++) {
        if (source[j] === 0x0a) line++;
      }

      let endTag = -1;
      let isStripRight = false;
      for (let j = contentStart; j < len - 1; j++) {
        if (source[j] === 0x25 && source[j + 1] === 0x7d) { // %}
          if (source[j - 1] === 0x2d) { // -%}
            isStripRight = true;
            endTag = j - 1;
          } else {
            endTag = j;
          }
          break;
        }
      }

      if (endTag === -1) {
        throw new Error(`Syntax Error: Unclosed tag at line ${line}`);
      }

      let actualStart = contentStart;
      while (actualStart < endTag && (source[actualStart] === 0x20 || source[actualStart] === 0x09 || source[actualStart] === 0x0a || source[actualStart] === 0x0d)) {
        actualStart++;
      }
      let actualEnd = endTag;
      while (actualEnd > actualStart && (source[actualEnd - 1] === 0x20 || source[actualEnd - 1] === 0x09 || source[actualEnd - 1] === 0x0a || source[actualEnd - 1] === 0x0d)) {
        actualEnd--;
      }

      const matchSource = (offset: number, str: string) => {
        if (offset + str.length > actualEnd) return false;
        for (let k = 0; k < str.length; k++) {
          if (source[offset + k] !== str.charCodeAt(k)) return false;
        }
        return true;
      };

      let type: TokenType = "Script";
      let valStart = actualStart;
      let valEnd = actualEnd;

      if (matchSource(actualStart, "%=")) {
        type = "PrintSafe";
        valStart += 2;
      } else if (matchSource(actualStart, "=")) {
        type = "PrintRaw";
        valStart += 1;
      } else if (matchSource(actualStart, "include ") || matchSource(actualStart, "include\t") || matchSource(actualStart, "include\n")) {
        type = "Include";
        valStart += 8;
      } else if (matchSource(actualStart, "extends ") || matchSource(actualStart, "extends\t") || matchSource(actualStart, "extends\n")) {
        type = "Extends";
        valStart += 8;
      } else if (matchSource(actualStart, "block ") || matchSource(actualStart, "block\t") || matchSource(actualStart, "block\n")) {
        type = "Block";
        valStart += 6;
      } else if (matchSource(actualStart, "endblock") && actualStart + 8 === actualEnd) {
        type = "EndBlock";
        valStart += 8;
      }

      while (valStart < valEnd && (source[valStart] === 0x20 || source[valStart] === 0x09 || source[valStart] === 0x0a || source[valStart] === 0x0d)) {
        valStart++;
      }
      while (valEnd > valStart && (source[valEnd - 1] === 0x20 || source[valEnd - 1] === 0x09 || source[valEnd - 1] === 0x0a || source[valEnd - 1] === 0x0d)) {
        valEnd--;
      }
      
      let content = "";
      if (type !== "EndBlock" && valStart < valEnd) {
         if (type === "Include" || type === "Extends") {
            if ((source[valStart] === 0x22 /*"*/ || source[valStart] === 0x27 /*'*/) && source[valStart] === source[valEnd - 1]) {
               valStart++;
               valEnd--;
            }
         }
         content = source.toString("utf8", valStart, valEnd);
      }

      tokens.push({ type, value: content, line });

      for (let j = tagStart; j <= (isStripRight ? endTag + 2 : endTag + 1); j++) {
        if (source[j] === 0x0a) line++;
      }

      i = isStripRight ? endTag + 3 : endTag + 2;
      textStart = i;

      if (isStripRight) {
        while (
          textStart < len &&
          (source[textStart] === 0x20 ||
            source[textStart] === 0x09 ||
            source[textStart] === 0x0a ||
            source[textStart] === 0x0d)
        ) {
          if (source[textStart] === 0x0a) line++;
          textStart++;
        }
        i = textStart;
      }
      continue;
    }
    i++;
  }

  if (textStart < len) {
    let text = source.toString("utf8", textStart, len);
    if (text.length > 0) {
      tokens.push({ type: "Text", value: text, line });
    }
  }

  return tokens;
}
