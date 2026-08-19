const test = require("node:test");
const assert = require("node:assert/strict");

const { validateExecutionTargets, resolveRuntimeTargets } = require("../src/registry/execution-targets");

test("accepts and deduplicates approved execution targets", () => {
  assert.deepEqual(validateExecutionTargets([
    { kind: "api", provider: "external-api" },
    { kind: "database", engine: "postgresql", role: "business-datasource" },
    { kind: "api", provider: "external-api" },
  ]), [
    { kind: "api", provider: "external-api" },
    { kind: "database", engine: "postgresql", role: "business-datasource" },
  ]);
});

test("rejects empty, unknown, and malformed targets", () => {
  assert.throws(() => validateExecutionTargets([]), /executionTargets/i);
  assert.throws(() => validateExecutionTargets([{ kind: "database", engine: "sql" }]), /unsupported database engine/i);
  assert.throws(() => validateExecutionTargets([{ kind: "api", provider: "http" }]), /unsupported api provider/i);
  assert.throws(() => validateExecutionTargets([{ kind: "local", engine: "mysql" }]), /unknown key/i);
});

test("resolves dynamic datasource engine to the real target", () => {
  const definition = { executionTargets: [
    { kind: "database", engine: "mysql", role: "platform-authority" },
    { kind: "database", engine: "postgresql", role: "business-datasource" },
    { kind: "database", engine: "oracle", role: "business-datasource" },
    { kind: "database", engine: "dm", role: "business-datasource" },
  ] };
  assert.deepEqual(resolveRuntimeTargets(definition, {}, { datasourceEngine: "oracle" }), [
    { kind: "database", engine: "mysql", role: "platform-authority" },
    { kind: "database", engine: "oracle", role: "business-datasource" },
  ]);
});
