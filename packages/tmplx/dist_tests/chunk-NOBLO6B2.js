// src/compiler/tokenizer.ts
function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const len = source.length;
  let textStart = 0;
  while (i < len) {
    if (source[i] === 123 && source[i + 1] === 37) {
      let tagStart = i;
      let isStripLeft = source[i + 2] === 45;
      let contentStart = isStripLeft ? i + 3 : i + 2;
      if (textStart < tagStart) {
        let textEnd = tagStart;
        if (isStripLeft) {
          while (textEnd > textStart && (source[textEnd - 1] === 32 || source[textEnd - 1] === 9 || source[textEnd - 1] === 10 || source[textEnd - 1] === 13)) {
            textEnd--;
          }
        }
        if (textStart < textEnd) {
          tokens.push({ type: "Text", value: source.toString("utf8", textStart, textEnd), line });
        }
      }
      for (let j = textStart; j < tagStart; j++) {
        if (source[j] === 10) line++;
      }
      let endTag = -1;
      let isStripRight = false;
      for (let j = contentStart; j < len - 1; j++) {
        if (source[j] === 37 && source[j + 1] === 125) {
          if (source[j - 1] === 45) {
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
      while (actualStart < endTag && (source[actualStart] === 32 || source[actualStart] === 9 || source[actualStart] === 10 || source[actualStart] === 13)) {
        actualStart++;
      }
      let actualEnd = endTag;
      while (actualEnd > actualStart && (source[actualEnd - 1] === 32 || source[actualEnd - 1] === 9 || source[actualEnd - 1] === 10 || source[actualEnd - 1] === 13)) {
        actualEnd--;
      }
      const matchSource = (offset, str) => {
        if (offset + str.length > actualEnd) return false;
        for (let k = 0; k < str.length; k++) {
          if (source[offset + k] !== str.charCodeAt(k)) return false;
        }
        return true;
      };
      let type = "Script";
      let valStart = actualStart;
      let valEnd = actualEnd;
      if (matchSource(actualStart, "%=")) {
        type = "PrintSafe";
        valStart += 2;
      } else if (matchSource(actualStart, "=")) {
        type = "PrintRaw";
        valStart += 1;
      } else if (matchSource(actualStart, "include ") || matchSource(actualStart, "include	") || matchSource(actualStart, "include\n")) {
        type = "Include";
        valStart += 8;
      } else if (matchSource(actualStart, "extends ") || matchSource(actualStart, "extends	") || matchSource(actualStart, "extends\n")) {
        type = "Extends";
        valStart += 8;
      } else if (matchSource(actualStart, "block ") || matchSource(actualStart, "block	") || matchSource(actualStart, "block\n")) {
        type = "Block";
        valStart += 6;
      } else if (matchSource(actualStart, "endblock") && actualStart + 8 === actualEnd) {
        type = "EndBlock";
        valStart += 8;
      }
      while (valStart < valEnd && (source[valStart] === 32 || source[valStart] === 9 || source[valStart] === 10 || source[valStart] === 13)) {
        valStart++;
      }
      while (valEnd > valStart && (source[valEnd - 1] === 32 || source[valEnd - 1] === 9 || source[valEnd - 1] === 10 || source[valEnd - 1] === 13)) {
        valEnd--;
      }
      let content = "";
      if (type !== "EndBlock" && valStart < valEnd) {
        if (type === "Include" || type === "Extends") {
          if ((source[valStart] === 34 || source[valStart] === 39) && source[valStart] === source[valEnd - 1]) {
            valStart++;
            valEnd--;
          }
        }
        content = source.toString("utf8", valStart, valEnd);
      }
      tokens.push({ type, value: content, line });
      for (let j = tagStart; j <= (isStripRight ? endTag + 2 : endTag + 1); j++) {
        if (source[j] === 10) line++;
      }
      i = isStripRight ? endTag + 3 : endTag + 2;
      textStart = i;
      if (isStripRight) {
        while (textStart < len && (source[textStart] === 32 || source[textStart] === 9 || source[textStart] === 10 || source[textStart] === 13)) {
          if (source[textStart] === 10) line++;
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

export {
  tokenize
};
