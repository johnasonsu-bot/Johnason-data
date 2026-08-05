const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const AppError = require("../../common/errors/app-error");
const service = require("./data-development.service");
const controller = require("./data-development.controller");

class StreamResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = {};
    this.output = "";
    this.writableEnded = false;
    this.destroyed = false;
  }

  setHeader(name, value) {
    this.headers[name] = value;
  }

  write(value) {
    this.output += value;
  }

  end() {
    this.writableEnded = true;
  }
}

test("runCopilotTaskStream returns an NDJSON error event after streaming has started", async () => {
  const original = service.runCopilotTaskStream;
  service.runCopilotTaskStream = async (_payload, context) => {
    context.write({ type: "meta", data: { modelName: "dsv4" } });
    throw new AppError("模型流式调用失败: The model `deepseek-chat` does not exist.", 400, {
      attemptedEndpoint: "http://model.local/v1/chat/completions",
    });
  };

  try {
    const res = new StreamResponse();
    await controller.runCopilotTaskStream({ validatedBody: {}, user: { id: 1 } }, res);

    const events = res.output.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(events[0].type, "meta");
    assert.equal(events[1].type, "error");
    assert.match(events[1].message, /deepseek-chat/);
    assert.equal(events[1].details.attemptedEndpoint, "http://model.local/v1/chat/completions");
    assert.equal(res.writableEnded, true);
  } finally {
    service.runCopilotTaskStream = original;
  }
});
