const { PlatformError } = require("../contracts/errors");

const ENGINES = new Set(["mysql", "postgresql", "oracle", "dm"]);

function createDialect(engine) {
  if (!ENGINES.has(engine)) throw new PlatformError("DATABASE_DRIVER_MISSING", `Unsupported database engine: ${engine}`);
  const quote = engine === "mysql" ? "`" : '"';
  function placeholder(index) {
    if (engine === "mysql") return "?";
    if (engine === "postgresql") return `$${index}`;
    return `:${index}`;
  }
  return Object.freeze({
    engine,
    quoteIdentifier(identifier) {
      const value = String(identifier);
      return `${quote}${value.replaceAll(quote, quote + quote)}${quote}`;
    },
    placeholder,
    paginate(sql, limit, offset) {
      const base = String(sql).replace(/;\s*$/, "");
      if (engine === "oracle") {
        return { sql: `${base} OFFSET ${placeholder(2)} ROWS FETCH NEXT ${placeholder(1)} ROWS ONLY`, params: [limit, offset] };
      }
      return { sql: `${base} LIMIT ${placeholder(1)} OFFSET ${placeholder(2)}`, params: [limit, offset] };
    },
    defaultSchema: engine === "postgresql" ? "public" : null,
  });
}

module.exports = { createDialect, DATABASE_ENGINES: ENGINES };
