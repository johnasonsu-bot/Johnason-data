const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const { ROLE_PROFILE_SPECS, COMMITTEE_MEMBER_ROLE_SPECS, ROLE_STAGE_TYPES } = require("./data-lab.model-profile-defaults");

function boolFlag(value) {
  return value ? 1 : 0;
}

function queryFirst(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableNormalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

function normalizeCodeSegment(value, fallback = "provider") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return normalized || fallback;
}

function buildAutoSeedModelCode(provider, stageType) {
  const providerCode = normalizeCodeSegment(provider?.configCode || provider?.modelName || provider?.id, "provider").slice(0, 24);
  return `autoseed_p${provider?.id || 0}_${providerCode}_${stageType}`.slice(0, 64);
}

function buildAutoSeedProfileName(provider, spec) {
  const providerName = String(provider?.configName || provider?.modelName || "默认模型").trim();
  return `${providerName} ${spec.profileLabel}`.slice(0, 128);
}

async function resolveActiveChatProvider(providerId, { strict = false } = {}) {
  let row = null;
  if (providerId) {
    const [rows] = await pool.query(
      `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
              model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl, status
       FROM model_providers
       WHERE id = ?
         AND model_category = 'chat'
         AND status = 'active'
       LIMIT 1`,
      [providerId]
    );
    row = queryFirst(rows);
  } else {
    const [rows] = await pool.query(
      `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
              model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl, status
       FROM model_providers
       WHERE model_category = 'chat'
         AND status = 'active'
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    );
    row = queryFirst(rows);
  }
  if (!row && strict) {
    throw new AppError("当前没有可用于角色种子的活跃聊天模型 Provider", 400);
  }
  return row
    ? {
        id: Number(row.id),
        configName: row.configName,
        configCode: row.configCode,
        providerType: row.providerType,
        modelCategory: row.modelCategory,
        modelName: row.modelName,
        baseUrl: row.baseUrl || null,
        status: row.status,
      }
    : null;
}

async function listRoleProfiles() {
  const placeholders = ROLE_STAGE_TYPES.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT p.id, p.profile_name AS profileName, p.stage_type AS stageType, p.provider_id AS providerId,
            p.model_name AS modelName, p.model_code AS modelCode, p.endpoint_url AS endpointUrl, p.auth_mode AS authMode,
            p.temperature, p.max_context_length AS maxContextLength, p.system_prompt AS systemPrompt,
            p.is_default AS isDefault, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt,
            provider.config_name AS providerName, provider.config_code AS providerCode, provider.provider_type AS providerType,
            provider.model_category AS modelCategory, provider.base_url AS providerBaseUrl, provider.status AS providerStatus
     FROM lab_model_profile p
     LEFT JOIN model_providers provider ON provider.id = p.provider_id
     WHERE p.stage_type IN (${placeholders})
     ORDER BY p.stage_type ASC, p.is_default DESC, p.updated_at DESC, p.id DESC`,
    ROLE_STAGE_TYPES
  );
  return rows.map((row) => ({
    id: Number(row.id),
    profileName: row.profileName,
    stageType: row.stageType,
    providerId: row.providerId ? Number(row.providerId) : null,
    providerName: row.providerName || null,
    providerCode: row.providerCode || null,
    providerType: row.providerType || null,
    providerBaseUrl: row.providerBaseUrl || null,
    providerStatus: row.providerStatus || null,
    modelCategory: row.modelCategory || null,
    modelName: row.modelName,
    modelCode: row.modelCode,
    endpointUrl: row.endpointUrl || null,
    authMode: row.authMode,
    temperature: Number(row.temperature || 0),
    maxContextLength: Number(row.maxContextLength || 0),
    systemPrompt: row.systemPrompt || null,
    isDefault: Boolean(row.isDefault),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

function buildDefaultRoleProfileMap(profiles = []) {
  const map = new Map();
  profiles.forEach((profile) => {
    if (!ROLE_STAGE_TYPES.includes(profile.stageType)) return;
    if (profile.status !== "active") return;
    if (!profile.providerId || profile.providerStatus !== "active" || profile.modelCategory !== "chat") return;
    const current = map.get(profile.stageType);
    if (!current || (!current.isDefault && profile.isDefault)) {
      map.set(profile.stageType, profile);
    }
  });
  return map;
}

function buildCommitteeConfig(modelCommittee = {}, defaultProfilesByRole = new Map()) {
  const rawCommittee = modelCommittee && typeof modelCommittee === "object" ? modelCommittee : {};
  const rawMembers = Array.isArray(rawCommittee.members) ? rawCommittee.members : [];
  const activeProfileIds = new Set(Array.from(defaultProfilesByRole.values()).map((item) => Number(item.id)));
  const memberMap = new Map(
    rawMembers
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.role || "").trim(), item])
      .filter(([role]) => role)
  );
  const nextMembers = COMMITTEE_MEMBER_ROLE_SPECS.map((spec) => {
    const existing = memberMap.get(spec.stageType);
    const existingProfileId = Number(existing?.modelProfileId || 0);
    const defaultProfile = defaultProfilesByRole.get(spec.stageType);
    const resolvedProfileId = activeProfileIds.has(existingProfileId)
      ? existingProfileId
      : Number(defaultProfile?.id || 0);
    if (!resolvedProfileId) {
      return null;
    }
    return {
      ...(existing && typeof existing === "object" ? existing : {}),
      role: spec.stageType,
      modelProfileId: resolvedProfileId,
      weight: Number(existing?.weight || spec.defaultWeight || 1),
    };
  }).filter(Boolean);
  const extraMembers = rawMembers.filter((item) => {
    const role = String(item?.role || "").trim();
    return role && !COMMITTEE_MEMBER_ROLE_SPECS.some((spec) => spec.stageType === role);
  });
  const defaultArbiter = defaultProfilesByRole.get("arbiter");
  const existingArbiterId = Number(rawCommittee.arbiterModelId || 0);
  const arbiterModelId = activeProfileIds.has(existingArbiterId)
    ? existingArbiterId
    : Number(defaultArbiter?.id || 0) || null;
  return {
    ...rawCommittee,
    votePolicy: String(rawCommittee.votePolicy || "weighted_vote"),
    agreementThreshold: Number(rawCommittee.agreementThreshold || 0.67),
    arbiterModelId,
    members: [...nextMembers, ...extraMembers],
  };
}

async function syncIndustryIncubationCommittees({ incubationId = null, defaultProfilesByRole = null } = {}) {
  const roleProfileMap = defaultProfilesByRole instanceof Map ? defaultProfilesByRole : buildDefaultRoleProfileMap(await listRoleProfiles());
  if (ROLE_STAGE_TYPES.some((stageType) => !roleProfileMap.has(stageType))) {
    return { total: 0, updated: 0 };
  }
  const [rows] = await pool.query(
    `SELECT id, model_committee_json AS modelCommittee
     FROM lab_industry_incubation
     WHERE (? IS NULL OR id = ?)
     ORDER BY id ASC`,
    [incubationId, incubationId]
  );
  let updated = 0;
  for (const row of rows) {
    const currentCommittee = safeJsonParse(row.modelCommittee, {});
    const nextCommittee = buildCommitteeConfig(currentCommittee, roleProfileMap);
    if (stableStringify(currentCommittee) === stableStringify(nextCommittee)) {
      continue;
    }
    await pool.query(
      `UPDATE lab_industry_incubation
       SET model_committee_json = ?
       WHERE id = ?`,
      [JSON.stringify(nextCommittee), Number(row.id)]
    );
    updated += 1;
  }
  return { total: rows.length, updated };
}

async function ensureDefaultCommitteeProfiles(options = {}) {
  const provider = await resolveActiveChatProvider(options.providerId || null, { strict: options.strict === true });
  if (!provider) {
    return {
      provider: null,
      created: 0,
      updated: 0,
      skipped: ROLE_PROFILE_SPECS.length,
      profilesByRole: new Map(),
      syncResult: { total: 0, updated: 0 },
    };
  }

  const existingProfiles = await listRoleProfiles();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const spec of ROLE_PROFILE_SPECS) {
    const stageProfiles = existingProfiles.filter((item) => item.stageType === spec.stageType);
    const activeDefault = stageProfiles.find(
      (item) => item.isDefault
        && item.status === "active"
        && item.providerId
        && item.providerStatus === "active"
        && item.modelCategory === "chat"
    );
    if (activeDefault) {
      skipped += 1;
      continue;
    }

    const autoSeedCode = buildAutoSeedModelCode(provider, spec.stageType);
    const autoSeedProfile = stageProfiles.find((item) => item.modelCode === autoSeedCode);
    await pool.query("UPDATE lab_model_profile SET is_default = 0 WHERE stage_type = ?", [spec.stageType]);

    if (autoSeedProfile) {
      await pool.query(
        `UPDATE lab_model_profile
         SET profile_name = ?, provider_id = ?, model_name = ?, endpoint_url = ?, auth_mode = 'bearer',
             temperature = ?, max_context_length = ?, system_prompt = ?, is_default = 1, status = 'active'
         WHERE id = ?`,
        [
          buildAutoSeedProfileName(provider, spec),
          provider.id,
          provider.modelName,
          provider.baseUrl || null,
          spec.temperature,
          spec.maxContextLength,
          spec.systemPrompt,
          autoSeedProfile.id,
        ]
      );
      updated += 1;
      continue;
    }

    await pool.query(
      `INSERT INTO lab_model_profile
        (profile_name, stage_type, provider_id, model_name, model_code, endpoint_url, auth_mode, temperature, max_context_length, system_prompt, is_default, status)
       VALUES (?, ?, ?, ?, ?, ?, 'bearer', ?, ?, ?, ?, 'active')`,
      [
        buildAutoSeedProfileName(provider, spec),
        spec.stageType,
        provider.id,
        provider.modelName,
        autoSeedCode,
        provider.baseUrl || null,
        spec.temperature,
        spec.maxContextLength,
        spec.systemPrompt,
        boolFlag(true),
      ]
    );
    created += 1;
  }

  const profilesByRole = buildDefaultRoleProfileMap(await listRoleProfiles());
  const syncResult = options.syncIncubations
    ? await syncIndustryIncubationCommittees({
        incubationId: options.incubationId || null,
        defaultProfilesByRole: profilesByRole,
      })
    : { total: 0, updated: 0 };

  return {
    provider,
    created,
    updated,
    skipped,
    profilesByRole,
    syncResult,
  };
}

module.exports = {
  buildAutoSeedModelCode,
  buildCommitteeConfig,
  buildDefaultRoleProfileMap,
  ensureDefaultCommitteeProfiles,
  listRoleProfiles,
  resolveActiveChatProvider,
  syncIndustryIncubationCommittees,
};
