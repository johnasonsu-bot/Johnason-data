const path = require("node:path");
const { z } = require("zod");

const profileSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  db: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    database: z.string().min(1),
    user: z.string().min(1),
    timezone: z.string().default("+08:00"),
  }).strict(),
  dataxHome: z.string().min(1).optional(),
  kafkaBootstrapServers: z.array(z.string().min(1)).optional(),
  currentProjectId: z.number().int().positive().optional(),
}).strict();

const stateSchema = z.object({
  currentProfile: z.string().nullable().default(null),
  profiles: z.array(profileSchema).default([]),
}).strict();

const secretKey = /password|secret|token|api[-_]?key/i;

function assertSecretFree(value, trail = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (secretKey.test(key)) {
      throw new Error(`Secret fields are forbidden in profile config: ${[...trail, key].join(".")}`);
    }
    assertSecretFree(child, [...trail, key]);
  }
}

function createProfileStore({ configFile, fsImpl }) {
  if (!configFile || !fsImpl) throw new TypeError("configFile and fsImpl are required");

  function read() {
    if (!fsImpl.existsSync(configFile)) return { currentProfile: null, profiles: [] };
    return stateSchema.parse(JSON.parse(fsImpl.readFileSync(configFile, "utf8")));
  }

  function write(state) {
    assertSecretFree(state);
    const normalized = stateSchema.parse(state);
    fsImpl.mkdirSync(path.dirname(configFile), { recursive: true, mode: 0o700 });
    const temporary = `${configFile}.tmp-${process.pid}`;
    try {
      fsImpl.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
      fsImpl.chmodSync(temporary, 0o600);
      fsImpl.renameSync(temporary, configFile);
      fsImpl.chmodSync(configFile, 0o600);
    } finally {
      if (fsImpl.existsSync(temporary)) fsImpl.unlinkSync(temporary);
    }
  }

  return {
    list() {
      return read().profiles.slice().sort((left, right) => left.name.localeCompare(right.name));
    },
    get(name) {
      return read().profiles.find((item) => item.name === name) || null;
    },
    current() {
      const state = read();
      return state.profiles.find((item) => item.name === state.currentProfile) || null;
    },
    add(candidate) {
      assertSecretFree(candidate);
      const value = profileSchema.parse(candidate);
      const state = read();
      if (state.profiles.some((item) => item.name === value.name)) {
        throw new Error(`Profile already exists: ${value.name}`);
      }
      state.profiles.push(value);
      write(state);
      return value;
    },
    remove(name) {
      const state = read();
      if (!state.profiles.some((item) => item.name === name)) throw new Error(`Profile not found: ${name}`);
      state.profiles = state.profiles.filter((item) => item.name !== name);
      if (state.currentProfile === name) state.currentProfile = null;
      write(state);
    },
    use(name) {
      const state = read();
      if (!state.profiles.some((item) => item.name === name)) throw new Error(`Profile not found: ${name}`);
      state.currentProfile = name;
      write(state);
    },
    setCurrentProject(name, projectId) {
      const state = read();
      const index = state.profiles.findIndex((item) => item.name === name);
      if (index < 0) throw new Error(`Profile not found: ${name}`);
      state.profiles[index] = profileSchema.parse({ ...state.profiles[index], currentProjectId: projectId });
      write(state);
      return state.profiles[index];
    },
  };
}

module.exports = { createProfileStore, profileSchema };
