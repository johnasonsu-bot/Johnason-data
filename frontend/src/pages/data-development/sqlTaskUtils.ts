export function splitSqlStatements(sqlText: string) {
  const statements: string[] = [];
  let current = "";
  let singleQuote = false;
  let doubleQuote = false;
  let backtickQuote = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    const next = sqlText[index + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += "/";
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (!singleQuote && !doubleQuote && !backtickQuote) {
      if (char === "-" && next === "-") {
        current += "--";
        index += 1;
        lineComment = true;
        continue;
      }
      if (char === "/" && next === "*") {
        current += "/*";
        index += 1;
        blockComment = true;
        continue;
      }
    }

    if (char === "'" && !doubleQuote && !backtickQuote) {
      if (singleQuote && next === "'") {
        current += "''";
        index += 1;
        continue;
      }
      singleQuote = !singleQuote;
      current += char;
      continue;
    }

    if (char === "\"" && !singleQuote && !backtickQuote) {
      if (doubleQuote && next === "\"") {
        current += "\"\"";
        index += 1;
        continue;
      }
      doubleQuote = !doubleQuote;
      current += char;
      continue;
    }

    if (char === "`" && !singleQuote && !doubleQuote) {
      backtickQuote = !backtickQuote;
      current += char;
      continue;
    }

    if (char === ";" && !singleQuote && !doubleQuote && !backtickQuote) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}
