const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const baseline = require(path.resolve(__dirname, "../../../docs/superpowers/specs/data-platform-cli-coverage-baseline.json"));
const { createFoundationCommands } = require("../src/registry/foundation-commands");
const { createCommandRegistry } = require("../src/registry/command-registry");

function registry() {
  const definitions = createFoundationCommands({
    keychain: {},
    core: { execute() {} },
    databaseCapabilities() { return []; },
    doctorPorts: {},
  });
  const result = createCommandRegistry();
  for (const definition of definitions) result.register(definition);
  return result;
}

test("foundation source API keys are present in the approved coverage baseline", () => {
  const approvedKeys = new Set(baseline.apiCoverage.map((entry) => entry.apiKey));
  const commands = registry();
  for (const command of [
    "auth login",
    "auth profile",
    "project list",
    "platform overview",
    "system doctor database-capabilities",
  ]) {
    const definition = commands.getByCommand(command);
    assert.ok(definition, `missing registry definition: ${command}`);
    assert.ok(definition.sourceApiKeys.length > 0, `missing source API keys: ${command}`);
    for (const sourceApiKey of definition.sourceApiKeys) {
      assert.equal(approvedKeys.has(sourceApiKey), true, `${command}: ${sourceApiKey}`);
    }
  }
});

test("the historical project command label drift does not invent a replacement source key", () => {
  const definition = registry().getByCommand("project list");
  assert.deepEqual(definition.sourceApiKeys, ["GET /api/v1/projects/my"]);
  assert.equal(baseline.apiCoverage.some((entry) => entry.apiKey === "GET /api/v1/projects/my"), true);
});
