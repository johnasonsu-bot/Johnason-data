#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const pluginRoot = path.join(projectRoot, "backend", "datax", "plugin");

function listZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const minimumEocdSize = 22;
  const firstCandidate = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;
  for (let offset = buffer.length - minimumEocdSize; offset >= firstCandidate; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error(`不是有效的 JAR/ZIP 文件: ${filePath}`);

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Set();
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`JAR 中央目录损坏: ${filePath}`);
    }
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.add(fileName);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function findJar(directory, pattern) {
  if (!fs.existsSync(directory)) return null;
  const fileName = fs.readdirSync(directory).find((name) => pattern.test(name));
  return fileName ? path.join(directory, fileName) : null;
}

function requireFile(relativePath) {
  const filePath = path.join(pluginRoot, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`缺少 DataX 文件: ${relativePath}`);
  return filePath;
}

function requireClass(jarPath, classPath, label) {
  if (!jarPath) throw new Error(`${label} JAR 不存在`);
  if (!listZipEntries(jarPath).has(classPath)) {
    throw new Error(`${label} 缺少可执行类 ${classPath}: ${path.relative(projectRoot, jarPath)}`);
  }
}

function verifyEnterpriseDataX() {
  const checks = [
    {
      label: "Oracle DataX reader",
      directory: "reader/oraclereader",
      pluginPattern: /^oraclereader-.*\.jar$/i,
      pluginClass: "com/alibaba/datax/plugin/reader/oraclereader/OracleReader.class",
      driverPattern: /^ojdbc.*\.jar$/i,
      driverClass: "oracle/jdbc/OracleDriver.class",
    },
    {
      label: "Oracle DataX writer",
      directory: "writer/oraclewriter",
      pluginPattern: /^oraclewriter-.*\.jar$/i,
      pluginClass: "com/alibaba/datax/plugin/writer/oraclewriter/OracleWriter.class",
      driverPattern: /^ojdbc.*\.jar$/i,
      driverClass: "oracle/jdbc/OracleDriver.class",
    },
    {
      label: "DM DataX reader",
      directory: "reader/rdbmsreader",
      pluginPattern: /^rdbmsreader-.*\.jar$/i,
      pluginClass: "com/alibaba/datax/plugin/reader/rdbmsreader/RdbmsReader.class",
      driverPattern: /^Dm.*JdbcDriver.*\.jar$/i,
      driverClass: "dm/jdbc/driver/DmDriver.class",
    },
    {
      label: "DM DataX writer",
      directory: "writer/rdbmswriter",
      pluginPattern: /^rdbmswriter-.*\.jar$/i,
      pluginClass: "com/alibaba/datax/plugin/reader/rdbmswriter/RdbmsWriter.class",
      driverPattern: /^Dm.*JdbcDriver.*\.jar$/i,
      driverClass: "dm/jdbc/driver/DmDriver.class",
    },
  ];

  const results = checks.map((check) => {
    requireFile(path.join(check.directory, "plugin.json"));
    requireFile(path.join(check.directory, "plugin_job_template.json"));
    const directory = path.join(pluginRoot, check.directory);
    const libsDirectory = path.join(directory, "libs");
    const pluginJar = findJar(directory, check.pluginPattern);
    const driverJar = findJar(libsDirectory, check.driverPattern);
    requireClass(pluginJar, check.pluginClass, `${check.label} 插件`);
    requireClass(driverJar, check.driverClass, `${check.label} JDBC 驱动`);
    return `${check.label}: ready`;
  });

  return results;
}

if (require.main === module) {
  try {
    verifyEnterpriseDataX().forEach((line) => process.stdout.write(`${line}\n`));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { listZipEntries, verifyEnterpriseDataX };
