const test = require("node:test");
const assert = require("node:assert/strict");
const { applyModelSelection } = require("./model-provider.utils");

function buildProvider() {
  return {
    id: 1,
    configName: "内网 DeepSeek",
    configCode: "intranet_deepseek",
    providerType: "custom",
    modelCategory: "chat",
    modelName: "dsv4",
    modelVersion: "dsv4",
    baseUrl: "http://127.0.0.1:8000/v1",
    apiKey: "test-key",
    status: "active",
    extraConfig: {
      modelCatalog: [{
        name: "dsv4",
        label: "dsv4",
        versions: [{ value: "dsv4", label: "dsv4" }],
      }],
    },
  };
}

test("applyModelSelection falls back to the current provider model when a saved scene model is stale", () => {
  const selected = applyModelSelection(buildProvider(), {
    modelName: "deepseek-chat",
    modelVersion: "deepseek-chat",
  });

  assert.equal(selected.modelName, "dsv4");
  assert.equal(selected.modelVersion, "dsv4");
  assert.equal(selected.selectedModelName, "dsv4");
  assert.equal(selected.selectedModelVersion, "dsv4");
});

test("applyModelSelection keeps a valid catalog model version", () => {
  const provider = buildProvider();
  provider.extraConfig.modelCatalog.push({
    name: "dsv4-pro",
    label: "dsv4-pro",
    versions: [{ value: "dsv4-pro", label: "dsv4-pro" }],
  });

  const selected = applyModelSelection(provider, {
    modelName: "dsv4-pro",
    modelVersion: "dsv4-pro",
  });

  assert.equal(selected.modelName, "dsv4-pro");
  assert.equal(selected.modelVersion, "dsv4-pro");
});
