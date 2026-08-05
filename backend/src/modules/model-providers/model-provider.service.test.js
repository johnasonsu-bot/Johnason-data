const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { generateChatCompletion, generateChatCompletionStream, testModelProvider } = require("./model-provider.service");

async function withModelServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}/v1`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function buildProvider(baseUrl) {
  return {
    id: 1,
    configName: "兼容模型",
    configCode: "compatible_model",
    providerType: "custom",
    modelCategory: "chat",
    modelName: "dsv4",
    modelVersion: "dsv4",
    baseUrl,
    apiKey: "test-key",
    status: "active",
  };
}

test("generateChatCompletionStream consumes an SSE frame without a trailing newline", async () => {
  await withModelServer((req, res) => {
    assert.equal(req.url, "/v1/chat/completions");
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end('data: {"choices":[{"delta":{"content":"OK"}}]}');
  }, async (baseUrl) => {
    let streamed = "";
    const result = await generateChatCompletionStream(
      buildProvider(baseUrl),
      [{ role: "user", content: "测试" }],
      { maxTokens: 16, timeoutMs: 3000 },
      async (delta) => {
        streamed += delta;
      }
    );

    assert.equal(streamed, "OK");
    assert.equal(result.content, "OK");
  });
});

test("generateChatCompletionStream accepts a non-stream OpenAI JSON fallback", async () => {
  await withModelServer((req, res) => {
    assert.equal(req.url, "/v1/chat/completions");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
  }, async (baseUrl) => {
    const result = await generateChatCompletionStream(
      buildProvider(baseUrl),
      [{ role: "user", content: "测试" }],
      { maxTokens: 16, timeoutMs: 3000 },
      () => {}
    );

    assert.equal(result.content, "OK");
  });
});

test("testModelProvider does not duplicate the v1 path for a custom provider", async () => {
  const requestedPaths = [];
  await withModelServer((req, res) => {
    requestedPaths.push(req.url);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "dsv4" }] }));
  }, async (baseUrl) => {
    const result = await testModelProvider({
      providerType: "custom",
      modelCategory: "chat",
      baseUrl,
      apiKey: "test-key",
      extraConfig: {},
    });

    assert.equal(result.success, true);
    assert.deepEqual(requestedPaths, ["/v1/models"]);
  });
});

test("generateChatCompletion can disable adaptive and endpoint retries", async () => {
  const requestedPaths = [];
  await withModelServer((req, res) => {
    requestedPaths.push(req.url);
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "temporary unavailable" } }));
  }, async (baseUrl) => {
    const provider = buildProvider(baseUrl.replace(/\/v1$/, ""));
    await assert.rejects(
      generateChatCompletion(
        provider,
        [{ role: "user", content: "测试" }],
        {
          maxTokens: 16,
          timeoutMs: 3000,
          disableAdaptiveRetry: true,
          primaryEndpointOnly: true,
        }
      )
    );
    assert.deepEqual(requestedPaths, ["/v1/chat/completions"]);
  });
});

test("DeepSeek compatible requests map the scene switch to thinking controls", async () => {
  let requestBody = null;
  await withModelServer(async (req, res) => {
    requestBody = JSON.parse(await new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => resolve(body));
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }));
  }, async (baseUrl) => {
    await generateChatCompletion(
      { ...buildProvider(baseUrl), modelName: "deepseek-v4-flash" },
      [{ role: "user", content: "测试" }],
      { maxTokens: 16, timeoutMs: 3000, thinkingEnabled: true, reasoningEffort: "max" }
    );
  });

  assert.deepEqual(requestBody.thinking, { type: "enabled" });
  assert.equal(requestBody.reasoning_effort, "max");
});

test("DeepSeek compatible requests can explicitly disable thinking", async () => {
  let requestBody = null;
  await withModelServer(async (req, res) => {
    requestBody = JSON.parse(await new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => resolve(body));
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }));
  }, async (baseUrl) => {
    await generateChatCompletion(
      { ...buildProvider(baseUrl), modelName: "deepseek-v4-flash" },
      [{ role: "user", content: "测试" }],
      { maxTokens: 16, timeoutMs: 3000, thinkingEnabled: false }
    );
  });

  assert.deepEqual(requestBody.thinking, { type: "disabled" });
  assert.equal(Object.prototype.hasOwnProperty.call(requestBody, "reasoning_effort"), false);
});

test("Qwen requests map thinking switch and budget", async () => {
  let requestBody = null;
  await withModelServer(async (req, res) => {
    requestBody = JSON.parse(await new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => resolve(body));
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }));
  }, async (baseUrl) => {
    await generateChatCompletion(
      { ...buildProvider(baseUrl), providerType: "qwen", modelName: "qwen-plus" },
      [{ role: "user", content: "测试" }],
      { maxTokens: 16, timeoutMs: 3000, thinkingEnabled: true, thinkingBudget: 256 }
    );
  });

  assert.equal(requestBody.enable_thinking, true);
  assert.equal(requestBody.thinking_budget, 256);
});

test("OpenAI chat requests map the switch to reasoning_effort", async () => {
  let requestBody = null;
  await withModelServer(async (req, res) => {
    requestBody = JSON.parse(await new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => resolve(body));
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }));
  }, async (baseUrl) => {
    await generateChatCompletion(
      { ...buildProvider(baseUrl), providerType: "openai", modelName: "gpt-5" },
      [{ role: "user", content: "测试" }],
      { maxTokens: 16, timeoutMs: 3000, thinkingEnabled: false, reasoningEffort: "high" }
    );
  });

  assert.equal(requestBody.reasoning_effort, "none");
});

test("reasoning-only responses report token exhaustion clearly", async () => {
  await withModelServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      choices: [{
        message: { content: "", reasoning_content: "内部思考过程" },
        finish_reason: "length",
      }],
    }));
  }, async (baseUrl) => {
    await assert.rejects(
      generateChatCompletion(
        { ...buildProvider(baseUrl), modelName: "deepseek-v4-flash" },
        [{ role: "user", content: "测试" }],
        { maxTokens: 16, timeoutMs: 3000, thinkingEnabled: true }
      ),
      /思考令牌已耗尽/
    );
  });
});
