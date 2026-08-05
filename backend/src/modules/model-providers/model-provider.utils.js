const { decryptSecret, encryptSecret } = require("../data-development/data-development.utils");

function parseExtraConfig(extraConfig) {
  if (!extraConfig) {
    return {};
  }

  if (typeof extraConfig === "object" && !Array.isArray(extraConfig)) {
    return { ...extraConfig };
  }

  try {
    const parsed = JSON.parse(extraConfig);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function sanitizeHeaderValue(key, value) {
  const normalizedKey = String(key || "").toLowerCase();
  if (
    normalizedKey.includes("authorization")
    || normalizedKey.includes("api-key")
    || normalizedKey.includes("apikey")
    || normalizedKey.includes("token")
    || normalizedKey.includes("secret")
  ) {
    return maskSecret(String(value || ""));
  }
  return value;
}

function isHeaderMapCandidate(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return false;
  }

  return Object.values(headers).every((value) => (
    value == null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ));
}

function sanitizeHeaderMap(headers) {
  if (!isHeaderMapCandidate(headers)) {
    return headers;
  }

  return Object.entries(headers).reduce((result, [key, value]) => {
    result[key] = sanitizeHeaderValue(key, value);
    return result;
  }, {});
}

function sanitizeExtraConfig(extraConfig) {
  const next = parseExtraConfig(extraConfig);
  ["defaultHeaders", "inferenceHeaders", "modelListHeaders"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = sanitizeHeaderMap(next[key]);
    }
  });

  if (next.headers && typeof next.headers === "object" && !Array.isArray(next.headers)) {
    if (isHeaderMapCandidate(next.headers)) {
      next.headers = sanitizeHeaderMap(next.headers);
    } else {
      ["default", "common", "inference", "modelList", "model_list"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(next.headers, key)) {
          next.headers[key] = sanitizeHeaderMap(next.headers[key]);
        }
      });
    }
  }
  return next;
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  if (text.length <= 8) {
    return `${text.slice(0, 1)}${"*".repeat(Math.max(2, text.length - 2))}${text.slice(-1)}`;
  }
  return `${text.slice(0, 3)}${"*".repeat(Math.min(16, Math.max(6, text.length - 6)))}${text.slice(-3)}`;
}

function normalizeModelCatalog(catalog = [], fallbackModelName = "", fallbackModelVersion = "") {
  const source = Array.isArray(catalog) ? catalog : [];
  const grouped = new Map();

  source.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const name = String(item.name || item.modelName || item.label || item.value || "").trim();
    if (!name) {
      return;
    }

    const label = String(item.label || item.modelLabel || name).trim() || name;
    const rawVersions = Array.isArray(item.versions) ? item.versions : [];

    if (!grouped.has(name)) {
      grouped.set(name, {
        name,
        label,
        versions: [],
      });
    }

    const bucket = grouped.get(name);
    rawVersions.forEach((versionItem) => {
      const value = String(versionItem?.value || versionItem?.id || versionItem?.modelId || versionItem?.name || "").trim();
      if (!value) {
        return;
      }
      if (!bucket.versions.some((existing) => existing.value === value)) {
        bucket.versions.push({
          value,
          label: String(versionItem?.label || versionItem?.name || value).trim() || value,
        });
      }
    });
  });

  const normalized = Array.from(grouped.values())
    .map((item) => ({
      name: item.name,
      label: item.label,
      versions: item.versions.length
        ? item.versions
        : [{ value: item.name, label: item.label }],
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));

  if (normalized.length) {
    return normalized;
  }

  const fallbackName = String(fallbackModelName || "").trim();
  const fallbackVersion = String(fallbackModelVersion || fallbackModelName || "").trim();
  if (!fallbackName && !fallbackVersion) {
    return [];
  }

  return [{
    name: fallbackName || fallbackVersion,
    label: fallbackName || fallbackVersion,
    versions: [{ value: fallbackVersion || fallbackName, label: fallbackVersion || fallbackName }],
  }];
}

function findCatalogVersion(catalog = [], modelName, modelVersion) {
  const name = String(modelName || "").trim();
  const version = String(modelVersion || "").trim();
  if (!name || !version) {
    return null;
  }
  const modelEntry = catalog.find((item) => item.name === name);
  if (!modelEntry) {
    return null;
  }
  return modelEntry.versions.find((item) => item.value === version) || null;
}

function splitModelIdentity(rawValue, rawLabel) {
  const value = String(rawValue || "").trim();
  const label = String(rawLabel || value).trim() || value;
  const match = value.match(/^(.*?)(?:[-_@:/])((?:20\d{2}[-_]\d{2}[-_]\d{2})|(?:v?\d+(?:\.\d+){0,2}))$/i);

  if (match && match[1]) {
    const modelName = match[1].replace(/[-_@:/]+$/, "").trim();
    const versionToken = match[2].trim();
    if (modelName) {
      return {
        modelName,
        modelLabel: modelName,
        versionValue: value,
        versionLabel: label === value ? versionToken : label,
      };
    }
  }

  return {
    modelName: value,
    modelLabel: label,
    versionValue: value,
    versionLabel: label,
  };
}

function buildModelCatalogFromRemoteModels(models = []) {
  const grouped = new Map();

  (Array.isArray(models) ? models : []).forEach((item) => {
    const value = String(item?.value || item?.id || item?.name || "").trim();
    if (!value) {
      return;
    }

    const label = String(item?.label || item?.name || value).trim() || value;
    const parsed = splitModelIdentity(value, label);
    if (!grouped.has(parsed.modelName)) {
      grouped.set(parsed.modelName, {
        name: parsed.modelName,
        label: parsed.modelLabel,
        versions: [],
      });
    }

    const bucket = grouped.get(parsed.modelName);
    if (!bucket.versions.some((versionItem) => versionItem.value === parsed.versionValue)) {
      bucket.versions.push({
        value: parsed.versionValue,
        label: parsed.versionLabel,
      });
    }
  });

  return normalizeModelCatalog(Array.from(grouped.values()));
}

function normalizeRuntimeProvider(provider) {
  if (!provider) {
    return null;
  }

  const extraConfig = parseExtraConfig(provider.extraConfig || provider.extra_config);
  const modelName = String(provider.modelName || provider.model_name || "").trim();
  const modelVersion = String(provider.modelVersion || provider.model_version || "").trim();

  return {
    id: Number(provider.id),
    configName: provider.configName || provider.config_name,
    configCode: provider.configCode || provider.config_code,
    providerType: provider.providerType || provider.provider_type,
    modelCategory: provider.modelCategory || provider.model_category,
    modelName,
    modelVersion: modelVersion || modelName,
    baseUrl: provider.baseUrl || provider.base_url || null,
    apiKey: decryptSecret(provider.apiKey || provider.api_key || ""),
    organizationId: provider.organizationId || provider.organization_id || null,
    ownerName: provider.ownerName || provider.owner_name || null,
    status: provider.status,
    description: provider.description || null,
    extraConfig,
    modelCatalog: normalizeModelCatalog(extraConfig.modelCatalog, modelName, modelVersion || modelName),
    createdAt: provider.createdAt || provider.created_at || null,
    updatedAt: provider.updatedAt || provider.updated_at || null,
  };
}

function normalizeDisplayProvider(provider) {
  const runtimeProvider = normalizeRuntimeProvider(provider);
  if (!runtimeProvider) {
    return null;
  }

  return {
    ...runtimeProvider,
    apiKey: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
    apiKeyMasked: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
    hasApiKey: Boolean(runtimeProvider.apiKey),
    extraConfig: sanitizeExtraConfig(runtimeProvider.extraConfig),
  };
}

function applyModelSelection(provider, selection = {}) {
  const runtimeProvider = normalizeRuntimeProvider(provider);
  if (!runtimeProvider) {
    return null;
  }

  const requestedModelName = String(selection.modelName || "").trim();
  const requestedModelVersion = String(selection.modelVersion || "").trim();
  const catalog = Array.isArray(runtimeProvider.modelCatalog) ? runtimeProvider.modelCatalog : [];
  const requestedCatalogModel = requestedModelName
    ? catalog.find((item) => item.name === requestedModelName)
    : null;
  const requestedCatalogVersion = requestedModelVersion
    ? catalog.flatMap((item) => item.versions || []).find((item) => item.value === requestedModelVersion)
    : null;
  const fallbackCatalogModel = catalog.find((item) => item.name === runtimeProvider.modelName) || catalog[0] || null;
  const selectedModelName = requestedCatalogModel?.name
    || fallbackCatalogModel?.name
    || requestedModelName
    || runtimeProvider.modelName;
  const selectedModelVersion = requestedCatalogVersion?.value
    || requestedCatalogModel?.versions?.[0]?.value
    || fallbackCatalogModel?.versions?.find((item) => item.value === runtimeProvider.modelVersion)?.value
    || fallbackCatalogModel?.versions?.[0]?.value
    || requestedModelVersion
    || runtimeProvider.modelVersion
    || runtimeProvider.modelName;

  return {
    ...runtimeProvider,
    modelName: selectedModelVersion,
    modelVersion: selectedModelVersion,
    selectedModelName,
    selectedModelVersion,
  };
}

function encryptProviderSecret(apiKey) {
  return encryptSecret(String(apiKey || "").trim());
}

module.exports = {
  applyModelSelection,
  buildModelCatalogFromRemoteModels,
  encryptProviderSecret,
  findCatalogVersion,
  maskSecret,
  normalizeDisplayProvider,
  normalizeModelCatalog,
  normalizeRuntimeProvider,
  parseExtraConfig,
};
