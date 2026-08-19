const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

function readInputFile(file) {
  const resolved = path.resolve(file);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`Input path is not a file: ${file}`);
  const content = fs.readFileSync(resolved, "utf8");
  return /\.ya?ml$/i.test(resolved) ? YAML.parse(content) : JSON.parse(content);
}

function readUploadFile(file) {
  const resolved = path.resolve(file);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`Upload path is not a file: ${file}`);
  return {
    path: resolved,
    originalname: path.basename(resolved),
    filename: path.basename(resolved),
    mimetype: "application/octet-stream",
    size: stat.size,
    buffer: fs.readFileSync(resolved),
  };
}

function assertOutputPath(file) {
  const resolved = path.resolve(file);
  if (fs.existsSync(resolved)) throw new Error(`Output already exists: ${file}`);
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    throw new Error(`Output directory does not exist: ${parent}`);
  }
  return resolved;
}

module.exports = { readInputFile, readUploadFile, assertOutputPath };
