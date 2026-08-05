export const LEGACY_MODEL_SCOPE_OPTIONS = [
  { label: "Scene Schema", value: "SCHEMA" },
  { label: "Scene Strategy", value: "STRATEGY" },
  { label: "Dirty Data", value: "DIRTY" },
  { label: "Realtime", value: "REALTIME" },
] as const;

export const COMMITTEE_ROLE_OPTIONS = [
  { label: "Researcher", value: "researcher" },
  { label: "Standard Extractor", value: "standard_extractor" },
  { label: "Distribution Analyst", value: "distribution_analyst" },
  { label: "Schema Reviewer", value: "schema_reviewer" },
  { label: "Realism Reviewer", value: "realism_reviewer" },
  { label: "Arbiter", value: "arbiter" },
] as const;

export const MODEL_SCOPE_OPTIONS = [
  {
    label: "Scene Defaults",
    options: [...LEGACY_MODEL_SCOPE_OPTIONS],
  },
  {
    label: "Incubation Committee",
    options: [...COMMITTEE_ROLE_OPTIONS],
  },
];

const scopeLabelMap = new Map<string, string>(
  MODEL_SCOPE_OPTIONS.flatMap((group) => group.options.map((item) => [item.value, item.label]))
);

const scopePromptMap: Record<string, string> = {
  researcher: "You expand Chinese domestic research queries and summarize scene evidence into structured JSON.",
  standard_extractor: "You extract Chinese domestic standards, tables, fields and constraints into structured JSON with source fidelity.",
  distribution_analyst: "You derive value corpora, distributions and field rules from public Chinese data into structured JSON.",
  schema_reviewer: "You review whether schema outputs match Chinese business flow, modules and required constraints.",
  realism_reviewer: "You review whether generated data looks like real Chinese business data and explain concrete realism risks.",
  arbiter: "You arbitrate conflicting committee outputs and choose the most defensible structured JSON result.",
  SCHEMA: "You are a Chinese schema design copilot. Output structured JSON only.",
  STRATEGY: "You are a Chinese data generation strategy copilot. Output structured JSON only.",
  DIRTY: "You are a Chinese dirty data planning copilot. Output structured JSON only.",
  REALTIME: "You are a Chinese realtime event planning copilot. Output structured JSON only.",
};

export function modelScopeLabel(scope?: string | null) {
  return scopeLabelMap.get(String(scope || "").trim()) || scope || "-";
}

export function normalizeCommitteeRole(role?: string | null) {
  const raw = String(role || "").trim();
  if (!raw) return "";
  const aliasMap: Record<string, string> = {
    standard: "standard_extractor",
    distribution: "distribution_analyst",
    schemaReview: "schema_reviewer",
    realism: "realism_reviewer",
  };
  return aliasMap[raw] || raw;
}

export function committeeRoleLabel(role?: string | null) {
  return modelScopeLabel(normalizeCommitteeRole(role));
}

export function defaultSystemPromptForScope(scope?: string | null) {
  return scopePromptMap[String(scope || "").trim()] || "";
}

export const VOTE_POLICY_OPTIONS = [
  { label: "Weighted Vote", value: "weighted_vote" },
  { label: "Majority Vote", value: "majority_vote" },
  { label: "Arbiter Final", value: "arbiter_final" },
] as const;

export function votePolicyLabel(value?: string | null) {
  if (value === "weighted_vote_fallback") {
    return "Weighted Fallback";
  }
  return VOTE_POLICY_OPTIONS.find((item) => item.value === value)?.label || value || "-";
}
