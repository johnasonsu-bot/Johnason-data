const http = require("node:http");

async function startModelProviderServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      return response.end(JSON.stringify({ object: "list", data: [{ id: "controlled-model", object: "model" }] }));
    }
    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      response.write('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n');
      return response.end("data: [DONE]\n\n");
    }
    response.writeHead(404, { "content-type": "application/json" });
    return response.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  });
}

module.exports = { startModelProviderServer };
