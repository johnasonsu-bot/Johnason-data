#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");

const root = path.resolve(__dirname, "..");
const inventory = require(path.join(root, "docs/cli/source/api-inventory.json"));
const output = path.join(root, "docs/superpowers/specs/data-platform-cli-handler-bindings.json");

const directAppBindings = {
  "GET /api/health": [{ source: "backend/src/app.js", exportName: "inlineHealth" }],
  "GET /api/v1/platform/database-capabilities": [{ source: "backend/src/common/utils/datasource-capabilities", exportName: "getRuntimeDatabaseCapabilityStatus" }],
  "GET /api/v1/jobs/:id": [{ source: "backend/src/modules/data-services/data-service.service", exportName: "inspectServiceJob" }],
  "POST /api/auth/login": [{ source: "backend/src/modules/auth/auth.controller", exportName: "login" }],
  "GET /api/auth/profile": [{ source: "backend/src/modules/auth/auth.controller", exportName: "profile" }],
  "GET /api/v1/reporting/runtime/dashboards/:id": [{ source: "backend/src/modules/reporting/reporting.controller", exportName: "getReportDashboardRuntime" }],
};

function extractFunctions(source) {
  const functions = new Map();
  const program = acorn.parse(source.replace(/^\uFEFF/, " "), {
    ecmaVersion: "latest",
    sourceType: "script",
    allowHashBang: true,
  });
  for (const node of program.body) {
    if (node.type === "FunctionDeclaration" && node.id?.name) {
      functions.set(node.id.name, source.slice(node.body.start + 1, node.body.end - 1));
    }
  }
  return functions;
}

function importsFor(file, source) {
  const aliases = new Map();
  for (const match of source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(["']([^"']+)["']\)/g)) {
    aliases.set(match[1], { source: match[2], imported: null });
  }
  for (const match of source.matchAll(/const\s+\{([^}]+)\}\s*=\s*require\(["']([^"']+)["']\)/g)) {
    for (const token of match[1].split(",")) {
      const [imported, local = imported] = token.trim().split(/\s*:\s*/);
      if (local) aliases.set(local, { source: match[2], imported });
    }
  }
  return new Map([...aliases].map(([alias, value]) => [alias, {
    ...value,
    resolvedSource: value.source.startsWith(".")
      ? path.relative(root, path.resolve(path.dirname(file), value.source)).replaceAll(path.sep, "/")
      : value.source,
  }]));
}

function callsFor(body, aliases) {
  const calls = [];
  for (const match of body.matchAll(/\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    const dependency = aliases.get(match[1]);
    if (!dependency) continue;
    calls.push({ source: dependency.resolvedSource, exportName: match[2] });
  }
  for (const [alias, dependency] of aliases) {
    if (!dependency.imported) continue;
    if (new RegExp(`\\b${alias}\\s*\\(`).test(body)) {
      calls.push({ source: dependency.resolvedSource, exportName: dependency.imported });
    }
  }
  return calls.filter((call, index, values) => (
    !/(?:common\/utils\/response|common\/errors\/app-error)$/.test(call.source)
    && values.findIndex((candidate) => candidate.source === call.source && candidate.exportName === call.exportName) === index
  ));
}

function sourceCandidates(route) {
  const routeFile = path.join(root, route.sourceFile);
  if (route.sourceFile === "backend/src/app.js") return [routeFile];
  const directory = path.dirname(routeFile);
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".controller.js"))
    .map((name) => path.join(directory, name))
    .concat(routeFile);
}

const bindings = inventory.routes.map((route) => {
  const apiKey = `${route.method} ${route.path}`;
  if (directAppBindings[apiKey]) {
    return {
      apiKey,
      module: route.module,
      controller: route.controller,
      controllerSource: route.sourceFile,
      handlerCalls: directAppBindings[apiKey],
      status: "bound",
    };
  }
  for (const file of sourceCandidates(route)) {
    const source = fs.readFileSync(file, "utf8");
    const body = extractFunctions(source).get(route.controller);
    if (!body) continue;
    const calls = callsFor(body, importsFor(file, source));
    if (calls.length) {
      return {
        apiKey,
        module: route.module,
        controller: route.controller,
        controllerSource: path.relative(root, file).replaceAll(path.sep, "/"),
        handlerCalls: calls,
        status: "bound",
      };
    }
  }
  return {
    apiKey,
    module: route.module,
    controller: route.controller,
    controllerSource: route.sourceFile,
    handlerCalls: [],
    status: "unresolved",
  };
});

const unresolved = bindings.filter((entry) => entry.status !== "bound");
const result = {
  schemaVersion: 1,
  source: {
    branch: inventory.branch,
    commit: inventory.commit,
    inventoryFile: "docs/cli/source/api-inventory.json",
  },
  gates: {
    expected: inventory.summary.routeCount,
    bound: bindings.length - unresolved.length,
    unresolved: unresolved.length,
  },
  bindings,
};

fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result.gates)}\n`);
if (unresolved.length) {
  process.stderr.write(`${JSON.stringify(unresolved, null, 2)}\n`);
  process.exitCode = 1;
}
