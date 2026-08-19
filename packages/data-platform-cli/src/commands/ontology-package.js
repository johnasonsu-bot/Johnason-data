const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { assertOutputPath } = require("./file-io");

const COMMON_COLUMNS = Object.freeze([
  "action",
  "natural_key",
  "depends_on",
  "enabled",
  "source_system",
  "source_ref",
  "payload_version",
  "notes",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function enabled(value) {
  return String(value || "").trim().toUpperCase() === "TRUE";
}

function dependencies(value) {
  return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function operationIdentity(sheet, row, naturalKey) {
  if (sheet === "12_\u4efb\u52a1\u5b57\u6bb5\u6620\u5c04") {
    return [naturalKey, row.target_table, row.target_field, row.key_role, row.transform].join("#");
  }
  if (sheet === "51_PG\u5b57\u6bb5") {
    return [naturalKey, row.target_view, row.target_field, row.key_role].join("#");
  }
  return naturalKey;
}

function readOntologyPackage(file) {
  const target = path.resolve(file);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new PlatformError("ONTOLOGY_PACKAGE_NOT_FOUND", `Ontology package not found: ${target}`);
  }
  if (!/\.xlsx?$/i.test(target)) {
    throw new PlatformError("ONTOLOGY_PACKAGE_FORMAT_INVALID", "Ontology package must be an XLSX workbook");
  }
  const content = fs.readFileSync(target);
  const workbook = XLSX.read(content, { type: "buffer", cellDates: true, raw: false });
  const sheets = Object.fromEntries(workbook.SheetNames.map((name) => [
    name,
    XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null, raw: false }),
  ]));
  return Object.freeze({ file: target, sha256: sha256(content), sheetNames: workbook.SheetNames, sheets });
}

function inspectOntologyPackage(workbook, options = {}) {
  if (!workbook?.sheets || typeof workbook.sheets !== "object") {
    throw new PlatformError("ONTOLOGY_PACKAGE_INVALID", "Parsed ontology workbook is required");
  }
  const environment = options.environment || {};
  const errors = [];
  const warnings = [];
  const keys = new Map();
  const operationKeys = new Map();
  const allRows = [];
  const sourceOnlyBlockers = [];
  const sheetCounts = {};

  for (const [sheet, rows] of Object.entries(workbook.sheets)) {
    if (sheet === "00_\u5bfc\u5165\u8bf4\u660e") continue;
    if (!Array.isArray(rows)) {
      errors.push(`Sheet is not tabular: ${sheet}`);
      continue;
    }
    const activeRows = rows.filter((row) => enabled(row.enabled));
    sheetCounts[sheet] = activeRows.length;
    for (const [index, row] of activeRows.entries()) {
      const rowNumber = index + 2;
      const missingColumns = COMMON_COLUMNS.filter((column) => !Object.hasOwn(row, column));
      if (missingColumns.length) errors.push(`Missing common columns in ${sheet}!${rowNumber}: ${missingColumns.join(", ")}`);
      const naturalKey = String(row.natural_key || row.step_code || row.check_code || "").trim();
      if (!naturalKey) errors.push(`Missing natural key in ${sheet}!${rowNumber}`);
      else {
        const identity = operationIdentity(sheet, row, naturalKey);
        if (operationKeys.has(identity)) errors.push(`Duplicate natural key: ${naturalKey} (${operationKeys.get(identity)} and ${sheet}!${rowNumber})`);
        else operationKeys.set(identity, `${sheet}!${rowNumber}`);
        if (!keys.has(naturalKey)) keys.set(naturalKey, `${sheet}!${rowNumber}`);
      }
      const descriptor = { sheet, rowNumber, naturalKey, dependsOn: dependencies(row.depends_on), row };
      allRows.push(descriptor);
      if (String(row.seed_status || "").toUpperCase() === "SOURCE_ONLY" || /^SOURCE_ONLY:/i.test(String(row.seed_payload_json || ""))) {
        sourceOnlyBlockers.push({
          sheet,
          rowNumber,
          naturalKey,
          sourceRef: row.source_ref || null,
          expectedRowCount: Number(row.expected_row_count || 0),
          reason: "The workbook declares that the versioned source rows are absent",
        });
      }
    }
  }

  for (const descriptor of allRows) {
    for (const dependency of descriptor.dependsOn) {
      if (!keys.has(dependency)) errors.push(`Dangling dependency: ${descriptor.naturalKey} -> ${dependency}`);
    }
  }

  const environmentRows = allRows.filter((entry) => entry.sheet === "02_\u73af\u5883\u53d8\u91cf");
  const unresolvedRequiredVariables = environmentRows
    .filter(({ row }) => enabled(row.required) && !String(environment[row.variable_name] || "").trim())
    .map(({ row }) => row.variable_name)
    .sort();
  if (unresolvedRequiredVariables.length) warnings.push(`Unresolved required environment variables: ${unresolvedRequiredVariables.join(", ")}`);
  if (sourceOnlyBlockers.length) warnings.push(`Source-only baseline rows are unavailable: ${sourceOnlyBlockers.length}`);

  const mappedSheets = new Set(allRows
    .filter((entry) => entry.sheet === "90_CLI\u6620\u5c04")
    .map(({ row }) => row.sheet_name)
    .filter(Boolean));
  const businessSheets = Object.entries(sheetCounts)
    .filter(([sheet, count]) => count > 0 && !["01_\u5bfc\u5165\u987a\u5e8f", "02_\u73af\u5883\u53d8\u91cf", "90_CLI\u6620\u5c04"].includes(sheet))
    .map(([sheet]) => sheet);
  for (const sheet of businessSheets) {
    if (!mappedSheets.has(sheet)) errors.push(`Missing CLI mapping for enabled sheet: ${sheet}`);
  }

  return Object.freeze({
    schemaVersion: "1.0.0",
    file: workbook.file || null,
    sha256: workbook.sha256 || null,
    valid: errors.length === 0,
    ready: errors.length === 0 && unresolvedRequiredVariables.length === 0 && sourceOnlyBlockers.length === 0,
    sheetCount: Object.keys(sheetCounts).length,
    enabledRows: allRows.length,
    sheetCounts,
    unresolvedRequiredVariables,
    sourceOnlyBlockers,
    errors,
    warnings,
  });
}

function packageStoreFile(paths, profile, projectId) {
  return path.join(paths.dataDir, "ontology", profile, String(projectId), "package.json");
}

function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function registerOntologyPackageCommands(parent, dependencies) {
  const { profileStore, paths, output, writeJson, envelope, selectedProfile, requiredProjectId } = dependencies;
  const packageCommand = parent.command("package").description("validate and track versioned ontology XLSX packages");

  function inspect(file, projectCode) {
    const environment = projectCode ? { ...process.env, AVIATION_PROJECT_CODE: projectCode } : process.env;
    return inspectOntologyPackage(readOntologyPackage(file), { environment });
  }

  packageCommand.command("validate")
    .requiredOption("--file <path>")
    .option("--project-code <code>")
    .option("--require-ready")
    .action((options) => {
      const result = inspect(options.file, options.projectCode);
      if (!result.valid) throw new PlatformError("ONTOLOGY_PACKAGE_INVALID", result.errors.join("; "));
      if (options.requireReady && !result.ready) throw new PlatformError("ONTOLOGY_PACKAGE_NOT_READY", result.warnings.join("; "));
      writeJson(output, envelope(result));
    });

  packageCommand.command("import")
    .requiredOption("--file <path>")
    .option("--project-code <code>")
    .action((options, command) => {
      const projectId = requiredProjectId(command);
      const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
      const result = inspect(options.file, options.projectCode);
      if (!result.valid) throw new PlatformError("ONTOLOGY_PACKAGE_INVALID", result.errors.join("; "));
      const target = packageStoreFile(paths, profile.name, projectId);
      const stored = { ...result, projectId, profile: profile.name, importedAt: new Date().toISOString() };
      writeAtomic(target, stored);
      writeJson(output, envelope({ imported: true, ready: result.ready, file: target, manifest: stored }));
    });

  packageCommand.command("show").action((_options, command) => {
    const projectId = requiredProjectId(command);
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    const target = packageStoreFile(paths, profile.name, projectId);
    if (!fs.existsSync(target)) throw new PlatformError("ONTOLOGY_PACKAGE_NOT_IMPORTED", "No ontology package has been imported for this project");
    writeJson(output, envelope(JSON.parse(fs.readFileSync(target, "utf8"))));
  });

  packageCommand.command("report")
    .requiredOption("--output <path>")
    .action((options, command) => {
      const projectId = requiredProjectId(command);
      const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
      const source = packageStoreFile(paths, profile.name, projectId);
      if (!fs.existsSync(source)) throw new PlatformError("ONTOLOGY_PACKAGE_NOT_IMPORTED", "No ontology package has been imported for this project");
      const target = assertOutputPath(options.output);
      fs.copyFileSync(source, target);
      writeJson(output, envelope({ output: target, bytes: fs.statSync(target).size }));
    });
}

module.exports = {
  COMMON_COLUMNS,
  inspectOntologyPackage,
  readOntologyPackage,
  registerOntologyPackageCommands,
};
