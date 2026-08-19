const test = require("node:test");
const assert = require("node:assert/strict");

const baseline = require("../../../docs/superpowers/specs/data-platform-cli-coverage-baseline.json");
const { createCapabilityCatalog } = require("@johnason/data-platform-core");
const { createDomainCommands } = require("../src/registry/domain-commands");
const { createProgram, selectCapabilities } = require("../src/main");

test("catalog and command tree cover all inventory entries", () => {
  const catalog = createCapabilityCatalog();
  const commands = createDomainCommands(catalog);
  const apiKeys = new Set(commands.flatMap((entry) => entry.sourceApiKeys));
  const frontendKeys = new Set(commands.flatMap((entry) => entry.sourceFrontendKeys));
  assert.equal(catalog.size, 596);
  assert.equal(apiKeys.size, baseline.gates.apiExpected);
  assert.equal(frontendKeys.size, baseline.gates.frontendExpected);
  assert.deepEqual([...apiKeys].sort(), baseline.apiCoverage.map((entry) => entry.apiKey).sort());
  assert.deepEqual([...frontendKeys].sort(), baseline.frontendCoverage.map((entry) => entry.frontendKey).sort());
});

test("every definition enforces its I/O and safety contract", () => {
  const commands = createDomainCommands(createCapabilityCatalog());
  for (const definition of commands) {
    assert.ok(definition.executionTargets.length > 0, definition.command);
    if (definition.destructive || definition.confirmationRequired) {
      assert.equal(definition.requiresYes, true, definition.command);
    }
    if (definition.interactions.includes("download")) {
      assert.equal(definition.requiresOutput, true, definition.command);
    }
    if (definition.interactions.includes("stream")) {
      if (definition.command === "knowledge-base stream-knowledge-document-content") {
        assert.equal(definition.requiresOutput, true, definition.command);
        assert.equal(definition.streamOutput, null, definition.command);
      } else {
        assert.equal(definition.streamOutput, "ndjson", definition.command);
      }
    }
    if (definition.executionModes.includes("async-job-capable")) {
      assert.equal(definition.supportsWait, true, definition.command);
      assert.equal(definition.supportsTimeout, true, definition.command);
    }
  }
});

test("all generated command help renders", () => {
  const runtime = { catalog: createCapabilityCatalog(), executeCapability() {} };
  const { program, definitions } = createProgram({ exitOverride: true, runtime });
  assert.ok(definitions.length > 0);
  assert.match(program.helpInformation(), /data-platform/);
  for (const command of program.commands) {
    assert.doesNotThrow(() => command.helpInformation(), command.name());
  }
});

test("shared command aliases execute one canonical capability by default", () => {
  const definition = createDomainCommands(createCapabilityCatalog()).find((entry) => entry.command === "auth login");
  assert.equal(definition.capabilityIds.length, 2);
  assert.deepEqual(selectCapabilities(definition, {}), [definition.capabilityIds[0]]);
  assert.deepEqual(selectCapabilities(definition, { apiKey: definition.sourceApiKeys[1] }), [definition.capabilityIds[1]]);
});
