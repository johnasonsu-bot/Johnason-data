const Module = require("node:module");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { Writable } = require("node:stream");

function sink() {
  let value = "";
  return Object.freeze({
    stream: new Writable({
      write(chunk, _encoding, callback) {
        value += String(chunk);
        callback();
      },
    }),
    value() { return value; },
  });
}

function createFakeRuntime() {
  const audit = { httpModules: [], urls: [], listeners: 0 };
  const sessions = new Map();
  const selectedProjects = [];
  const stdout = sink();
  const stderr = sink();
  const profile = {
    name: "dev",
    db: { host: "db.invalid", port: 3306, database: "platform", user: "operator" },
  };
  const user = {
    id: 7,
    sub: 7,
    username: "alice",
    displayName: "Alice",
    roleId: 2,
    roleCode: "developer",
    roleType: "developer",
    roleName: "Developer",
    defaultProjectId: null,
    permissions: { modules: ["system_projects"] },
  };
  const projects = [
    { id: 12, code: "aviation", name: "Aviation", role: "developer", modules: ["system_projects"] },
  ];
  const keychain = {
    getDatabasePassword() { return "keychain-database-password"; },
    getSessionToken(name) { return sessions.get(name) || null; },
    setSessionToken(name, token) { sessions.set(name, token); },
    deleteSessionToken(name) { return sessions.delete(name); },
  };
  const databaseRuntime = {
    pool: {},
    async testConnection() {},
    async close() {},
  };
  const core = {
    async runWithDatabaseRuntime(_runtime, callback) { return callback(); },
    async execute(capabilityId, input) {
      if (capabilityId === "auth.login") return { token: "signed-token", user };
      if (capabilityId === "auth.profile") return { user };
      if (capabilityId === "auth.logout") return { success: true };
      if (capabilityId === "project.list-my") return projects;
      if (capabilityId === "project.access-check") {
        return { allowed: true, project: { id: input.projectId }, member: { projectRole: "developer" }, modules: ["system_projects"] };
      }
      throw new Error(`Unexpected capability: ${capabilityId}`);
    },
  };
  const profileStore = {
    current() { return profile; },
    get(name) { return name === profile.name ? profile : null; },
    setCurrentProject(name, projectId) { selectedProjects.push([name, projectId]); },
  };

  async function run(callback) {
    const originalLoad = Module._load;
    const originalFetch = globalThis.fetch;
    const originalListen = net.Server.prototype.listen;
    const originalHttpRequest = http.request;
    const originalHttpGet = http.get;
    const originalHttpsRequest = https.request;
    const originalHttpsGet = https.get;
    const forbiddenModules = new Set(["http", "node:http", "https", "node:https", "http2", "node:http2", "express"]);

    function attemptedUrl(args) {
      const candidate = args[0];
      audit.urls.push(candidate instanceof URL ? candidate.href : String(candidate));
      throw new Error("fake-runtime audit: outbound URL attempted");
    }

    Module._load = function auditedLoad(request, parent, isMain) {
      if (forbiddenModules.has(request)) {
        audit.httpModules.push(request);
        throw new Error(`fake-runtime audit: forbidden module ${request}`);
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    globalThis.fetch = (...args) => attemptedUrl(args);
    net.Server.prototype.listen = function auditedListen() {
      audit.listeners += 1;
      throw new Error("fake-runtime audit: listener started");
    };
    http.request = (...args) => attemptedUrl(args);
    http.get = (...args) => attemptedUrl(args);
    https.request = (...args) => attemptedUrl(args);
    https.get = (...args) => attemptedUrl(args);

    try {
      return await callback();
    } finally {
      Module._load = originalLoad;
      globalThis.fetch = originalFetch;
      net.Server.prototype.listen = originalListen;
      http.request = originalHttpRequest;
      http.get = originalHttpGet;
      https.request = originalHttpsRequest;
      https.get = originalHttpsGet;
    }
  }

  return Object.freeze({
    audit,
    keychain,
    selectedProjects,
    stdout,
    stderr,
    run,
    dependencies: {
      core,
      profile,
      profileStore,
      keychain,
      databaseRuntime,
      createDatabaseRuntime() { return databaseRuntime; },
      createRuntimePorts() { return {}; },
      sessionIdentity: { verify() { return { sub: user.id }; } },
      readHiddenInput: async () => "platform-password",
      databaseCapabilities: () => [{ type: "mysql", available: true }],
      doctorPorts: {},
      stdout: stdout.stream,
      stderr: stderr.stream,
      stdin: { isTTY: false },
    },
  });
}

module.exports = { createFakeRuntime };
