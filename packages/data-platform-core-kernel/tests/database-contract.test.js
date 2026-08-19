const test = require("node:test");
const assert = require("node:assert/strict");

const { createDialect, createDatabaseAdapter, normalizeDatabaseError } = require("../src");

test("four engines implement identifier, placeholder, and pagination contracts", () => {
  const expected = {
    mysql: { quoted: "`a``b`", placeholders: ["?", "?"], page: "SELECT * FROM t LIMIT ? OFFSET ?" },
    postgresql: { quoted: '"a""b"', placeholders: ["$1", "$2"], page: "SELECT * FROM t LIMIT $1 OFFSET $2" },
    oracle: { quoted: '"a""b"', placeholders: [":1", ":2"], page: "SELECT * FROM t OFFSET :2 ROWS FETCH NEXT :1 ROWS ONLY" },
    dm: { quoted: '"a""b"', placeholders: [":1", ":2"], page: "SELECT * FROM t LIMIT :1 OFFSET :2" },
  };
  for (const [engine, contract] of Object.entries(expected)) {
    const dialect = createDialect(engine);
    assert.equal(dialect.quoteIdentifier('a"b'.replace('"', engine === "mysql" ? "`" : '"')), contract.quoted);
    assert.deepEqual([dialect.placeholder(1), dialect.placeholder(2)], contract.placeholders);
    assert.equal(dialect.paginate("SELECT * FROM t", 10, 20).sql, contract.page);
  }
});

test("adapter normalizes results, transaction lifecycle, and cleanup", async () => {
  const calls = [];
  const driver = {
    async connect() {
      return {
        async query(sql, params) { calls.push(["query", sql, params]); return { rows: [{ N: 1 }], rowCount: 1 }; },
        async begin() { calls.push(["begin"]); },
        async commit() { calls.push(["commit"]); },
        async rollback() { calls.push(["rollback"]); },
        async close() { calls.push(["close"]); },
      };
    },
  };
  const adapter = createDatabaseAdapter("postgresql", driver);
  assert.deepEqual(await adapter.execute("SELECT 1", []), { rows: [{ N: 1 }], rowCount: 1 });
  await adapter.transaction(async (connection) => connection.query("UPDATE t SET a=$1", [1]));
  await assert.rejects(adapter.transaction(async () => { throw new Error("stop"); }), /stop/);
  assert.equal(calls.filter(([name]) => name === "close").length, 3);
  assert.equal(calls.filter(([name]) => name === "commit").length, 1);
  assert.equal(calls.filter(([name]) => name === "rollback").length, 1);
});

test("database errors have stable codes and redact credentials", () => {
  const error = normalizeDatabaseError(Object.assign(new Error("password=leak host=db"), { code: "ECONNREFUSED" }));
  assert.equal(error.code, "DATABASE_CONNECTION_FAILED");
  assert.doesNotMatch(error.message, /leak/);
  assert.match(error.message, /\[REDACTED\]/);
});
