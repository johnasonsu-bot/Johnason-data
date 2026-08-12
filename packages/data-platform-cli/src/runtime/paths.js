const path = require("node:path");

function resolveCliPaths({ platform = process.platform, env = process.env, homeDir }) {
  if (!homeDir) {
    throw new TypeError("homeDir is required");
  }

  let configDir;
  let dataDir;
  if (platform === "darwin") {
    configDir = path.join(homeDir, "Library", "Application Support", "data-platform-cli");
    dataDir = configDir;
  } else if (platform === "win32") {
    configDir = path.join(env.APPDATA || path.join(homeDir, "AppData", "Roaming"), "data-platform-cli");
    dataDir = path.join(env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"), "data-platform-cli");
  } else {
    configDir = path.join(env.XDG_CONFIG_HOME || path.join(homeDir, ".config"), "data-platform-cli");
    dataDir = path.join(env.XDG_DATA_HOME || path.join(homeDir, ".local", "share"), "data-platform-cli");
  }

  return {
    configDir,
    dataDir,
    configFile: path.join(configDir, "config.json"),
  };
}

module.exports = { resolveCliPaths };
