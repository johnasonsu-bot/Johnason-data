const fs = require("node:fs");
const path = require("node:path");
const { createAviationAcceptance, validateOntologyContract, validateLineage } = require("@johnason/data-platform-core");
const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { createOntologyCommands } = require("./ontology");
const { registerOntologyPackageCommands } = require("./ontology-package");
const { readInputFile, assertOutputPath } = require("./file-io");
const { envelope, writeJson } = require("../output");

function dataOf(result) {
  return result && typeof result === "object" && Object.hasOwn(result, "data") ? result.data : result;
}

function selectedProfile(profileStore, name) {
  const profile = name ? profileStore.get(name) : profileStore.current();
  if (!profile) throw new PlatformError("PROFILE_REQUIRED", "Select a profile or pass --profile");
  return profile;
}

function localStoreFile(paths, profile, projectId, kind) {
  return path.join(paths.dataDir, "ontology", profile, String(projectId), `${kind}.json`);
}

function requiredProjectId(command) {
  const value = command.optsWithGlobals().project;
  if (!value) throw new PlatformError("PROJECT_REQUIRED", "This command requires --project");
  return Number(value);
}

function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function registerProjectFacades(program, { runtime, profileStore, output }) {
  const project = program.commands.find((entry) => entry.name() === "project")
    || program.command("project").description("project capabilities");
  const list = [...runtime.catalog.values()].find((entry) => entry.command === "project list-my-projects");
  if (!list) return;

  async function projects(command) {
    const options = command.optsWithGlobals();
    return dataOf(await runtime.executeCapability(list.capabilityId, {}, { profile: options.profile || null }));
  }
  project.command("resolve")
    .option("--code <code>", "project code")
    .option("--name <name>", "project name")
    .option("--require-one", "require exactly one project")
    .action(async (_options, command) => {
      const options = command.opts();
      const values = await projects(command);
      const matches = (Array.isArray(values) ? values : []).filter((item) => (
        (!options.code || item.projectCode === options.code) && (!options.name || item.projectName === options.name)
      ));
      if (options.requireOne && matches.length !== 1) {
        throw new PlatformError("PROJECT_NOT_UNIQUE", `Expected one project, found ${matches.length}`);
      }
      writeJson(output, envelope(options.requireOne ? matches[0] : matches));
    });
  project.command("use <id>").action(async (id, _options, command) => {
    if (!profileStore) throw new PlatformError("PROFILE_REQUIRED", "Project selection requires a profile store");
    const values = await projects(command);
    const match = (Array.isArray(values) ? values : []).find((item) => Number(item.id) === Number(id));
    if (!match) throw new PlatformError("PROJECT_NOT_FOUND", `Project not found or inaccessible: ${id}`);
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    profileStore.setCurrentProject(profile.name, Number(id));
    writeJson(output, envelope({ profile: profile.name, project: match }));
  });
  project.command("access-check")
    .requiredOption("--action <action>", "read or write")
    .action(async (_options, command) => {
      const options = command.opts();
      const projectId = requiredProjectId(command);
      const values = await projects(command);
      const match = (Array.isArray(values) ? values : []).find((item) => Number(item.id) === projectId);
      if (!match) throw new PlatformError("PROJECT_ACCESS_FORBIDDEN", "Project is not accessible");
      writeJson(output, envelope({ allowed: true, projectId, action: options.action }));
    });
}

function registerOntologyFacades(program, { profileStore, paths, output }) {
  if (!profileStore || !paths) return;
  const commands = createOntologyCommands();
  const ontology = program.command("ontology").description("versioned ontology contracts, lineage, graphs, and simulations");
  const contract = ontology.command("contract");
  contract.command("validate").requiredOption("--file <path>").action((options) => writeJson(output, envelope(commands.validateContract(options.file))));
  contract.command("import").requiredOption("--file <path>").action((options, command) => {
    const projectId = requiredProjectId(command);
    const value = validateOntologyContract(readInputFile(options.file));
    if (Number(value.projectId) !== projectId) throw new PlatformError("ONTOLOGY_PROJECT_MISMATCH", "Contract project differs from --project");
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    const file = localStoreFile(paths, profile.name, projectId, "contract");
    writeAtomic(file, value);
    writeJson(output, envelope({ imported: true, file, contract: value }));
  });
  contract.command("show").action((_options, command) => {
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    writeJson(output, envelope(readInputFile(localStoreFile(paths, profile.name, requiredProjectId(command), "contract"))));
  });
  contract.command("diff").requiredOption("--file <path>").action((options, command) => {
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    const current = readInputFile(localStoreFile(paths, profile.name, requiredProjectId(command), "contract"));
    const candidate = validateOntologyContract(readInputFile(options.file));
    writeJson(output, envelope({ equal: JSON.stringify(current) === JSON.stringify(candidate), current, candidate }));
  });

  const lineage = ontology.command("lineage");
  lineage.command("validate").requiredOption("--file <path>").requiredOption("--contract <path>").action((options) => writeJson(output, envelope(commands.validateLineage(options.file, options.contract))));
  lineage.command("import").requiredOption("--file <path>").action((options, command) => {
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    const projectId = requiredProjectId(command);
    const contractValue = readInputFile(localStoreFile(paths, profile.name, projectId, "contract"));
    const value = validateLineage(readInputFile(options.file), contractValue);
    const file = localStoreFile(paths, profile.name, projectId, "lineage");
    writeAtomic(file, value);
    writeJson(output, envelope({ imported: true, file, lineage: value }));
  });
  lineage.command("show").action((_options, command) => {
    const profile = selectedProfile(profileStore, command.optsWithGlobals().profile);
    writeJson(output, envelope(readInputFile(localStoreFile(paths, profile.name, requiredProjectId(command), "lineage"))));
  });

  const graph = ontology.command("graph");
  graph.command("export").requiredOption("--contract <path>").requiredOption("--output <path>").action((options) => writeJson(output, envelope(commands.exportGraph(options.contract, options.output))));
  graph.command("verify").requiredOption("--contract <path>").requiredOption("--html <path>").action((options) => writeJson(output, envelope(commands.verifyGraph(options.contract, options.html))));
  const simulation = ontology.command("simulation");
  simulation.command("export").requiredOption("--contract <path>").requiredOption("--output <path>").action((options) => writeJson(output, envelope(commands.exportSimulation(options.contract, options.output))));
  simulation.command("verify").requiredOption("--contract <path>").requiredOption("--html <path>").action((options) => writeJson(output, envelope(commands.verifySimulation(options.contract, options.html))));
  registerOntologyPackageCommands(ontology, {
    profileStore,
    paths,
    output,
    writeJson,
    envelope,
    selectedProfile,
    requiredProjectId,
  });
}

function registerAcceptanceFacades(program, { runtime, output }) {
  const acceptance = program.command("acceptance").description("strict workflow evidence verification");
  const aviation = acceptance.command("aviation-ontology");
  aviation.command("preflight").requiredOption("--contract <path>").action((options, command) => {
    const selectedProjectId = requiredProjectId(command);
    const contract = validateOntologyContract(readInputFile(options.contract));
    if (Number(contract.projectId) !== selectedProjectId) throw new PlatformError("AVIATION_PROJECT_MISMATCH", "Contract project differs from CLI project");
    writeJson(output, envelope({ ready: true, projectId: selectedProjectId, contractId: contract.contractId }));
  });
  aviation.command("run").requiredOption("--contract <path>").requiredOption("--stage-evidence <path>").action(async (options, command) => {
    const selectedProjectId = requiredProjectId(command);
    const evidence = readInputFile(options.stageEvidence);
    if (evidence.real !== true || evidence.mock === true) {
      throw new PlatformError("AVIATION_REAL_EVIDENCE_REQUIRED", "Aviation acceptance requires real, non-mock stage evidence");
    }
    if (Number(evidence.bypassCount) !== 0 || (evidence.bypasses || []).length) {
      throw new PlatformError("AVIATION_FORBIDDEN_BYPASS", "Aviation acceptance evidence contains a bypass");
    }
    if (Number(evidence.secretFindings) !== 0) {
      throw new PlatformError("AVIATION_SECRET_FINDING", "Aviation acceptance evidence contains a secret finding");
    }
    if (!evidence.environmentFingerprint || /password|secret|token|authorization/i.test(JSON.stringify(evidence.environmentFingerprint))) {
      throw new PlatformError("AVIATION_ENVIRONMENT_EVIDENCE_REQUIRED", "A redacted environment fingerprint is required");
    }
    const checkpoints = new Map((evidence.checkpoints || []).map((entry) => [entry.stage, entry]));
    const workflow = createAviationAcceptance({ executeStage: async (stage) => {
      const checkpoint = checkpoints.get(stage);
      if (!checkpoint) throw new PlatformError("AVIATION_STAGE_EVIDENCE_MISSING", `Missing stage evidence: ${stage}`);
      if (checkpoint.real !== true || checkpoint.mock === true) {
        throw new PlatformError("AVIATION_REAL_EVIDENCE_REQUIRED", `Stage evidence is not real: ${stage}`);
      }
      if (!(checkpoint.capabilityIds || []).length) {
        throw new PlatformError("AVIATION_CAPABILITY_EVIDENCE_MISSING", `Stage capability evidence is missing: ${stage}`);
      }
      for (const id of checkpoint.capabilityIds || []) {
        if (!runtime.catalog.has(id)) throw new PlatformError("AVIATION_CAPABILITY_UNKNOWN", `Unknown capability evidence: ${id}`);
      }
      return checkpoint;
    } });
    writeJson(output, envelope(await workflow.run({ contract: readInputFile(options.contract), projectId: selectedProjectId, runId: evidence.id })));
  });
  aviation.command("verify").requiredOption("--run <path>").action((options) => {
    const workflow = createAviationAcceptance({ executeStage() { throw new Error("not used"); } });
    writeJson(output, envelope(workflow.verify(readInputFile(options.run))));
  });
  aviation.command("report").requiredOption("--run <path>").requiredOption("--output <path>").action((options) => {
    const run = readInputFile(options.run);
    const target = assertOutputPath(options.output);
    fs.writeFileSync(target, `${JSON.stringify(run, null, 2)}\n`);
    writeJson(output, envelope({ output: target, bytes: fs.statSync(target).size }));
  });
}

function registerFoundationCommands(program, options) {
  registerProjectFacades(program, options);
  registerOntologyFacades(program, options);
  registerAcceptanceFacades(program, options);
}

module.exports = { registerFoundationCommands };
