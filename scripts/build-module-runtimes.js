#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const { builtinModules } = require("node:module");

const root = path.resolve(__dirname, "..");
const bindings = require(path.join(root, "docs/superpowers/specs/data-platform-cli-handler-bindings.json"));
const lockfile = require(path.join(root, "package-lock.json"));
const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

const ownership = {
  auth: ["auth"],
  "project-spaces": ["projects"],
  platform: ["platform", "health", "platform-runtime"],
  "asset-search": ["asset-search"],
  "data-development": ["data-development"],
  "data-lab": ["data-modeling"],
  "data-lab-sources": ["data-modeling-sources"],
  "data-map": ["data-map"],
  "data-services": ["data-services", "service-runtime"],
  "data-source-research": ["data-source-research"],
  "data-sources": ["data-sources"],
  "data-standards": ["data-standards"],
  "dev-ai-configs": ["dev-ai-configs"],
  "file-imports": ["file-imports"],
  "ingestion-ai-configs": ["ingestion-ai-configs"],
  "ingestion-tasks": ["ingestion-tasks"],
  "model-providers": ["model-providers"],
  "quality-control": ["quality-control"],
  reporting: ["reporting", "reporting-ai-configs"],
  "system-knowledge-base": ["system-knowledge-bases"],
  "system-management": ["system-management"],
};

const selectedModules = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const modules = selectedModules.length ? selectedModules : Object.keys(ownership);

function moduleRequest(value) {
  if (value.startsWith("@")) return value.split("/").slice(0, 2).join("/");
  return value.split("/")[0];
}

function exactInstalledVersion(name) {
  return lockfile.packages?.[`node_modules/${name}`]?.version || null;
}

function runtimePortPlugin() {
  return {
    name: "data-platform-runtime-ports",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!args.path.startsWith(".")) return null;
        const resolved = path.resolve(args.resolveDir, args.path).replaceAll(path.sep, "/");
        if (/\/config\/(?:database|db)$/.test(resolved)) return { path: "database", namespace: "runtime-port" };
        if (/\/config\/env$/.test(resolved)) return { path: "config", namespace: "runtime-port" };
        if (/\/common\/utils\/project-context$/.test(resolved)) return { path: "project-context", namespace: "runtime-port" };
        return null;
      });
      build.onLoad({ filter: /.*/, namespace: "runtime-port" }, (args) => {
        if (args.path === "database") {
          return { contents: 'const { createDatabasePoolProxy } = require("@johnason/data-platform-core-kernel"); const pool = createDatabasePoolProxy(); module.exports = { pool, testConnection: async () => { const c = await pool.getConnection(); c.release(); } };', loader: "js", resolveDir: root };
        }
        if (args.path === "config") {
          return { contents: 'const { createRuntimeConfigProxy } = require("@johnason/data-platform-core-kernel"); module.exports = createRuntimeConfigProxy();', loader: "js", resolveDir: root };
        }
        return { contents: 'const k = require("@johnason/data-platform-core-kernel"); module.exports = { runWithProjectContext: (_context, callback) => callback(), getProjectContext: k.getProjectContext, getCurrentProjectId: k.getCurrentProjectId, getProjectCondition: k.getProjectCondition, addProjectCondition: k.addProjectCondition };', loader: "js", resolveDir: root };
      });
    },
  };
}

function entrySource(moduleName, moduleBindings) {
  const sources = [...new Set(moduleBindings
    .filter((entry) => entry.controller && entry.controllerSource.endsWith(".controller.js"))
    .map((entry) => entry.controllerSource))];
  const imports = sources.map((source, index) => `const controller${index} = require(${JSON.stringify(path.join(root, source))});`).join("\n");
  const sourceIndex = new Map(sources.map((source, index) => [source, index]));
  const handlers = moduleBindings.map((binding) => {
    const apiKey = JSON.stringify(binding.apiKey);
    if (binding.apiKey === "GET /api/health") return `${apiKey}: async (_req, res) => res.json({ status: "ok", service: "medata-platform" })`;
    if (binding.apiKey === "GET /api/v1/platform/database-capabilities") {
      return `${apiKey}: async (_req, res) => res.json({ data: require(${JSON.stringify(path.join(root, "backend/src/common/utils/datasource-capabilities"))}).getRuntimeDatabaseCapabilityStatus() })`;
    }
    if (binding.apiKey === "GET /api/v1/jobs/:id") {
      return `${apiKey}: async (req, res) => res.json(await require(${JSON.stringify(path.join(root, "backend/src/modules/data-services/data-service.service"))}).inspectServiceJob(Number(req.params.id), { headers: req.headers, ip: req.ip, req }))`;
    }
    if (binding.apiKey === "POST /api/auth/login") {
      return `${apiKey}: require(${JSON.stringify(path.join(root, "backend/src/modules/auth/auth.controller"))}).login`;
    }
    if (binding.apiKey === "GET /api/auth/profile") {
      return `${apiKey}: require(${JSON.stringify(path.join(root, "backend/src/modules/auth/auth.controller"))}).profile`;
    }
    if (binding.apiKey === "GET /api/v1/reporting/runtime/dashboards/:id") {
      return `${apiKey}: require(${JSON.stringify(path.join(root, "backend/src/modules/reporting/reporting.controller"))}).getReportDashboardRuntime`;
    }
    if (binding.module === "service-runtime") {
      return `${apiKey}: async (req, res) => { const result = await require(${JSON.stringify(path.join(root, "backend/src/modules/data-services/data-service.service"))}).invokeService(req.method, req.params[0] || "/", req.method === "GET" ? req.query : req.body, { headers: req.headers, ip: req.ip, req }); return res.json({ success: true, data: result.data, meta: result.meta, service: result.service, app: result.app }); }`;
    }
    const index = sourceIndex.get(binding.controllerSource);
    return `${apiKey}: controller${index}[${JSON.stringify(binding.controller)}]`;
  }).join(",\n");

  return `
${imports}

const { Writable } = require("node:stream");

const handlers = { ${handlers} };

function routeParams(apiKey, input) {
  const pathTemplate = apiKey.slice(apiKey.indexOf(" ") + 1);
  const params = { ...((input && input.params) || {}) };
  for (const match of pathTemplate.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = match[1];
    if (params[name] === undefined) params[name] = input?.[name] ?? (name === "id" ? input?.id : undefined);
  }
  if (pathTemplate.includes("*") && params[0] === undefined) params[0] = input?.path || "/";
  return params;
}

function createResponse() {
  const response = new Writable({
    write(chunk, _encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback(); },
    final(callback) { this.payload ??= Buffer.concat(this.chunks); callback(); },
  });
  response.statusCode = 200;
  response.headers = {};
  response.payload = undefined;
  response.chunks = [];
  response.status = function status(code) { this.statusCode = code; return this; };
  response.setHeader = function setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; return this; };
  response.json = function json(value) { this.payload = value; this.end(); return value; };
  response.send = function send(value) { this.payload = value; this.end(); return value; };
  response.download = function download(file, name) { this.payload = { path: file, filename: name }; this.end(); return this.payload; };
  return response;
}

async function executeCapability(definition, input = {}, context = {}) {
  const apiKey = definition.sourceApiKeys[0];
  const handler = handlers[apiKey];
  if (typeof handler !== "function") {
    const error = new Error("No bundled handler for " + apiKey);
    error.code = "CAPABILITY_HANDLER_MISSING";
    throw error;
  }
  const method = apiKey.slice(0, apiKey.indexOf(" "));
  const body = input.body && typeof input.body === "object" ? input.body : input;
  const req = context.request || {
    method,
    params: routeParams(apiKey, input),
    query: input.query || (method === "GET" ? input : {}),
    body,
    validatedBody: body,
    headers: input.headers || {},
    user: context.actor || input.actor || null,
    projectId: context.projectId || input.projectId || null,
    file: input.file || null,
    files: input.files || null,
    ip: null,
    protocol: "cli",
    socket: {},
    get(name) { return this.headers[String(name).toLowerCase()] || this.headers[name] || ""; },
  };
  const res = context.response || createResponse();
  const returned = await handler(req, res);
  if (!context.response && returned === res && !res.writableFinished) {
    await new Promise((resolve, reject) => {
      res.once("finish", resolve);
      res.once("error", reject);
    });
  }
  const payload = res.payload === undefined ? returned : res.payload;
  if (context.response) {
    return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers || {} };
  }
  if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return { data: payload.data, meta: payload.meta ?? null, statusCode: res.statusCode, headers: res.headers };
  }
  return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers };
}

module.exports = { executeCapability, createResponse, handlerApiKeys: Object.freeze(Object.keys(handlers)) };
`;
}

async function buildModule(moduleName) {
  if (!ownership[moduleName]) throw new Error(`Unknown module: ${moduleName}`);
  const moduleDir = path.join(root, `packages/data-platform-module-${moduleName}`);
  const moduleBindings = bindings.bindings.filter((entry) => ownership[moduleName].includes(entry.module));
  const entryFile = path.join(moduleDir, "src/.runtime-entry.js");
  fs.writeFileSync(entryFile, entrySource(moduleName, moduleBindings));
  let result;
  try {
    result = await esbuild.build({
      entryPoints: [entryFile],
      outfile: path.join(moduleDir, "src/runtime.js"),
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      packages: "external",
      plugins: [runtimePortPlugin()],
      metafile: true,
      logLevel: "warning",
      legalComments: "none",
    });
  } finally {
    fs.unlinkSync(entryFile);
  }

  const pkgFile = path.join(moduleDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  const dependencies = { "@johnason/data-platform-core-kernel": "0.2.0" };
  const metadataEntries = [...Object.values(result.metafile.inputs), ...Object.values(result.metafile.outputs)];
  for (const metadata of metadataEntries) {
    for (const imported of metadata.imports || []) {
      if (imported.external && !builtins.has(imported.path) && !builtins.has(moduleRequest(imported.path))) {
        const name = moduleRequest(imported.path);
        if (name === "@johnason/data-platform-core-kernel") continue;
        const version = exactInstalledVersion(name);
        if (!version) throw new Error(`No installed exact version for ${name} in ${moduleName}`);
        dependencies[name] = version;
      }
    }
  }
  pkg.dependencies = Object.fromEntries(Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)));
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

  const indexFile = path.join(moduleDir, "src/index.js");
  fs.writeFileSync(indexFile, [
    'const { validateModuleManifest } = require("@johnason/data-platform-core-kernel");',
    'const { executeCapability } = require("./runtime");',
    'const moduleManifest = validateModuleManifest(require("./manifest.json"));',
    '',
    'function createCapabilities(dependencies = {}) {',
    '  const execute = dependencies.executeCapability || executeCapability;',
    '  return new Map(moduleManifest.capabilities.map((definition) => [definition.capabilityId, {',
    '    ...definition,',
    '    execute(input, context) { return execute(definition, input, context); },',
    '  }]));',
    '}',
    '',
    'module.exports = { moduleManifest, createCapabilities };',
    '',
  ].join("\n"));

  const runtime = fs.readFileSync(path.join(moduleDir, "src/runtime.js"), "utf8");
  if (runtime.includes(root) || /require\(["'](?:express|commander)["']\)/.test(runtime)) {
    throw new Error(`Runtime boundary violation in ${moduleName}`);
  }
  process.stdout.write(`${moduleName}: ${moduleBindings.length} handlers, ${Buffer.byteLength(runtime)} bytes\n`);
}

(async () => {
  for (const moduleName of modules) await buildModule(moduleName);
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
