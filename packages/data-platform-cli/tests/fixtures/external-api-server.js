const http = require("node:http");
const { EventEmitter } = require("node:events");

function json(response, status, payload, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(payload));
}

async function startExternalApiServer({ retryFailures = 0 } = {}) {
  const state = new EventEmitter();
  state.retryAttempts = 0;
  state.cancelledRequests = 0;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/success") return json(response, 200, { data: { source: "controlled-external-api", status: "ok" } });
    if (url.pathname === "/pages") {
      const page = Number(url.searchParams.get("page") || "1");
      return json(response, 200, page === 1
        ? { data: ["row-1", "row-2"], nextPage: 2 }
        : { data: ["row-3", "row-4"], nextPage: null });
    }
    if (url.pathname === "/rate-limit") return json(response, 429, { error: "rate_limited" }, { "retry-after": "1" });
    if (url.pathname === "/retry") {
      state.retryAttempts += 1;
      if (state.retryAttempts <= retryFailures) return json(response, 503, { error: "temporary_unavailable" });
      return json(response, 200, { data: { attempt: state.retryAttempts, retried: state.retryAttempts > 1 } });
    }
    if (url.pathname === "/malformed") {
      response.writeHead(200, { "content-type": "application/json" });
      return response.end("{not-json");
    }
    if (url.pathname === "/stream") {
      response.writeHead(200, { "content-type": "application/x-ndjson" });
      response.write(`${JSON.stringify({ event: "progress", sequence: 1 })}\n`);
      return response.end(`${JSON.stringify({ event: "complete", sequence: 2 })}\n`);
    }
    if (url.pathname === "/timeout") return undefined;
    if (url.pathname === "/cancel") {
      state.emit("cancellable-request");
      request.once("aborted", () => {
        state.cancelledRequests += 1;
        state.emit("cancelled");
      });
      return undefined;
    }
    return json(response, 404, { error: "not_found" });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  });
}

module.exports = { startExternalApiServer };
