const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const workspaceRoot = path.resolve(__dirname, "../../..");
const installPrefix = path.join(workspaceRoot, ".local", "data-platform-cli", "install");
const packageRoot = path.resolve(__dirname, "..");

function installedPackageProvenanceTestOptions(prefix = installPrefix) {
  return fs.existsSync(prefix) ? {} : { skip: "requires the repository-owned local CLI install" };
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function findVerifiedLocalInstall() {
  const prefix = fs.realpathSync(installPrefix);
  const packageJson = path.join(prefix, "node_modules", "@johnason", "data-platform-cli", "package.json");
  const packagePath = fs.realpathSync(packageJson);
  if (!isWithin(prefix, packagePath)) throw new Error("packed CLI package is outside the approved local install prefix");
  const installedPackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const sourcePackage = require("../package.json");
  if (installedPackage.name !== "@johnason/data-platform-cli" || installedPackage.version !== sourcePackage.version) {
    throw new Error("packed CLI package name or version does not match this repository");
  }
  const binRelative = installedPackage.bin?.["data-platform"];
  if (typeof binRelative !== "string") throw new Error("packed CLI package does not declare data-platform bin");
  const packageDirectory = path.dirname(packagePath);
  const binary = fs.realpathSync(path.join(packageDirectory, binRelative));
  const shim = fs.realpathSync(path.join(prefix, "node_modules", ".bin", "data-platform"));
  if (binary !== shim || !isWithin(packageDirectory, binary) || !isWithin(prefix, binary)) {
    throw new Error("packed CLI bin does not resolve to the repository-owned package bin");
  }
  return { prefix, binary, package: installedPackage, packageDirectory };
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function currentPackManifest() {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: packageRoot, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error("cannot produce current npm-pack manifest");
  const manifest = JSON.parse(result.stdout);
  if (!Array.isArray(manifest) || manifest.length !== 1 || !Array.isArray(manifest[0].files)) {
    throw new Error("current npm-pack manifest is invalid");
  }
  return manifest[0].files.map((entry) => entry.path).sort();
}

function verifyCurrentPackedInstall() {
  const installed = findVerifiedLocalInstall();
  const manifest = currentPackManifest();
  for (const relative of manifest) {
    const source = path.join(packageRoot, relative);
    const packed = path.join(installed.packageDirectory, relative);
    if (!fs.existsSync(source) || !fs.existsSync(packed) || hashFile(source) !== hashFile(packed)) {
      throw new Error(`installed package content differs from current npm-pack file: ${relative}`);
    }
  }
  return { ...installed, manifestFiles: manifest.length };
}

module.exports = {
  installPrefix,
  installedPackageProvenanceTestOptions,
  findVerifiedLocalInstall,
  verifyCurrentPackedInstall,
};
