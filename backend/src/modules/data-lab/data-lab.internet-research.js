const evidenceParser = require("./data-lab.evidence-parser");

const GAP_INTENTS = [
  ["业务流程", "处置流程", "办理流程", "工作流程"],
  ["台账", "记录表", "清单", "报表", "明细"],
  ["状态", "类型", "等级", "分类", "编码", "代码集", "枚举值"],
  ["机构", "人员", "对象", "设备", "资源", "物资", "队伍"],
  ["职责", "协同", "联动", "评估", "考核", "预警", "响应"],
  ["信息系统", "平台", "功能", "模块", "数据项", "数据元"],
];

const SOURCE_TYPE_QUERY_MAP = {
  国家标准: ["国家标准 数据元", "国家标准 数据表", "标准 代码集"],
  行业标准: ["行业标准 数据规范", "行业标准 信息模型", "行业标准 数据元"],
  法规政策: ["管理办法 政策 要求", "法规 政策 制度", "实施方案 通知"],
  建设规范: ["信息系统 建设规范", "平台 建设方案", "建设要求 数据规范"],
  公开数据: ["公开数据 统计公报", "数据开放 平台", "数据目录 指标"],
};

const DEFAULT_PREFERRED_DOMAINS = [
  "gov.cn",
  "edu.cn",
  "org.cn",
  "www.gov.cn",
  "npc.gov.cn",
];

const OFFICIAL_DOMAINS = [
  "gov.cn",
  "edu.cn",
  "org.cn",
  "www.gov.cn",
  "www.moe.gov.cn",
  "moe.gov.cn",
  "npc.gov.cn",
  "samr.gov.cn",
  "mot.gov.cn",
  "mem.gov.cn",
];

function normalizeIndustryLabel(value) {
  return String(value || "").trim() || "行业";
}

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "www.");
}

function parseBingResults(html) {
  const results = [];
  const pattern = /<li class="b_algo"[\s\S]*?<h2><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?(?:<p>([\s\S]*?)<\/p>)?[\s\S]*?<\/li>/gi;
  let match;
  while ((match = pattern.exec(String(html || ""))) !== null) {
    const url = evidenceParser.decodeHtmlEntities(match[1]);
    const title = evidenceParser.stripHtml(match[2]);
    const snippet = evidenceParser.stripHtml(match[3] || "");
    if (!url || !/^https?:\/\//i.test(url)) continue;
    results.push({ url, title, snippet });
  }
  return results;
}

function hostMatchesWhitelist(url, whitelist = []) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const normalizedWhitelist = (Array.isArray(whitelist) ? whitelist : [])
      .map(normalizeDomain)
      .filter(Boolean);
    if (normalizedWhitelist.length === 0) return true;
    return normalizedWhitelist.some((rule) => host === rule || host.endsWith(`.${rule}`));
  } catch {
    return false;
  }
}

function buildSiteScopedQueries(baseQueries, whitelist) {
  const scopedQueries = [];
  const normalizedWhitelist = (Array.isArray(whitelist) ? whitelist : [])
    .map(normalizeDomain)
    .filter(Boolean);
  for (const query of baseQueries) {
    scopedQueries.push(query);
    for (const domain of normalizedWhitelist.slice(0, 6)) {
      scopedQueries.push(`site:${domain} ${query}`);
    }
  }
  return [...new Set(scopedQueries.filter(Boolean))];
}

function normalizeKeywordList(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function normalizeSourceTypes(values) {
  return normalizeKeywordList(values).map((item) => item.replace(/\s+/g, ""));
}

function scoreSearchResult(result, options = {}) {
  const text = `${result?.title || ""} ${result?.snippet || ""}`.toLowerCase();
  const gapKeywords = normalizeKeywordList(options.gapKeywords).map((item) => item.toLowerCase());
  const queryTokens = String(options.query || "")
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item && !item.startsWith("site:"));
  let score = 0;
  gapKeywords.forEach((keyword) => {
    if (keyword && text.includes(keyword)) score += 3;
  });
  queryTokens.forEach((token) => {
    if (token && text.includes(token)) score += 1;
  });
  if (hostMatchesWhitelist(result?.url || "", options.preferredDomains || [])) {
    score += 2;
  }
  return score;
}

async function searchBing(query) {
  const response = await fetch(`https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-hans&ensearch=0&count=10`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`bing_search_failed_${response.status}`);
  }
  const html = await response.text();
  return parseBingResults(html);
}

async function fetchPageSnapshot(url, metadata = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`page_fetch_failed_${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return evidenceParser.parseFetchedEvidence({
    url,
    responseUrl: response.url || url,
    contentType: response.headers.get("content-type") || "",
    buffer,
    sourceType: metadata.sourceType,
    searchQuery: metadata.searchQuery,
    fetchedAt: metadata.fetchedAt || new Date().toISOString(),
    titleHint: metadata.titleHint,
    snippet: metadata.snippet,
  });
}

function buildResearchQueries({
  industryLabel,
  sceneName,
  subScenario,
  requiredKeywords = [],
  sourceTypes = [],
  preferredDomains = [],
  plannedQueries = [],
  gapKeywords = [],
  mode = "industry",
}) {
  const normalizedIndustryLabel = normalizeIndustryLabel(industryLabel);
  const sceneToken = [normalizedIndustryLabel, sceneName, subScenario].filter(Boolean).join(" ").trim();
  const queries = normalizeKeywordList(plannedQueries);
  const normalizedSourceTypes = normalizeSourceTypes(sourceTypes);

  normalizedSourceTypes.forEach((sourceType) => {
    const templates = SOURCE_TYPE_QUERY_MAP[sourceType] || [];
    templates.forEach((template) => {
      queries.push(`${sceneToken} ${template}`.trim());
    });
  });

  normalizeKeywordList(requiredKeywords).forEach((keyword) => {
    queries.push(`${sceneToken} ${keyword}`.trim());
  });

  normalizeKeywordList(gapKeywords).slice(0, 20).forEach((keyword) => {
    GAP_INTENTS.forEach((intentTerms) => {
      intentTerms.slice(0, 2).forEach((intent) => {
        queries.push(`${sceneToken} ${keyword} ${intent}`.trim());
      });
    });
    queries.push(`${sceneToken} ${keyword} 数据项`.trim());
    queries.push(`${sceneToken} ${keyword} 代码集`.trim());
    queries.push(`${sceneToken} ${keyword} 信息项`.trim());
  });

  if (mode === "category") {
    GAP_INTENTS.forEach((intentTerms) => {
      intentTerms.forEach((intent) => {
        queries.push(`${sceneToken} ${intent}`.trim());
      });
    });
  }

  if (queries.length === 0) {
    [
      `${sceneToken} 管理办法`,
      `${sceneToken} 数据标准`,
      `${sceneToken} 信息系统 建设规范`,
      `${sceneToken} 公开数据`,
      `${sceneToken} 统计公报`,
      `${sceneToken} 代码集`,
      `${sceneToken} 数据元`,
      `${sceneToken} 指标体系`,
    ].forEach((query) => queries.push(query.trim()));
  }

  return buildSiteScopedQueries(
    [...new Set(queries.filter(Boolean))],
    Array.isArray(preferredDomains) ? preferredDomains : []
  );
}

function shouldAcceptDomesticEvidence(evidence, options = {}) {
  if (!evidence) return false;
  if (options.domesticOnly === false) return true;
  const sourceUrl = String(evidence.sourceUrl || "");
  const officialDomestic = OFFICIAL_DOMAINS.some((domain) => hostMatchesWhitelist(sourceUrl, [domain]));
  if (officialDomestic) {
    return true;
  }
  if (evidence.nonCnyCurrencyHitCount > 0) return false;
  if (evidence.foreignRegionHitCount > 0) return false;
  if (evidence.foreignTermHitCount > 2) return false;
  return true;
}

async function collectDomainScopedEvidence(options, whitelist, evidence, seenHashes, seenUrls) {
  const normalizedWhitelist = (Array.isArray(whitelist) ? whitelist : [])
    .map(normalizeDomain)
    .filter(Boolean);
  const baseQueries = [
    `${normalizeIndustryLabel(options.industryLabel)} ${String(options.sceneName || "").trim()} 管理办法`.trim(),
    `${normalizeIndustryLabel(options.industryLabel)} ${String(options.sceneName || "").trim()} 数据标准`.trim(),
  ].filter(Boolean);

  for (const domain of normalizedWhitelist.slice(0, 4)) {
    for (const query of baseQueries) {
      let results = [];
      try {
        results = await searchBing(`site:${domain} ${query}`);
      } catch {
        continue;
      }
      for (const item of results.slice(0, 3)) {
        if (seenUrls.has(item.url)) continue;
        seenUrls.add(item.url);
        try {
          const snapshot = await fetchPageSnapshot(item.url, {
            sourceType: options.sourceTypeResolver ? options.sourceTypeResolver(query, item) : "行业公开资料",
            searchQuery: query,
            titleHint: item.title,
            snippet: item.snippet,
          });
          if (!snapshot || !shouldAcceptDomesticEvidence(snapshot, options)) continue;
          if (seenHashes.has(snapshot.sourceHash)) continue;
          seenHashes.add(snapshot.sourceHash);
          evidence.push(snapshot);
          if (evidence.length >= Number(options.limit || 12)) return;
        } catch {
          continue;
        }
      }
    }
  }
}

async function collectDomesticEvidence(options) {
  const configuredDomains = (Array.isArray(options.preferredDomains) ? options.preferredDomains : []).filter(Boolean);
  const whitelist = [...new Set((configuredDomains.length > 0 ? configuredDomains : DEFAULT_PREFERRED_DOMAINS).filter(Boolean))];
  const queries = buildResearchQueries({
    ...options,
    preferredDomains: whitelist,
  });
  const evidence = [];
  const seenHashes = new Set();
  const seenUrls = new Set();

  await collectDomainScopedEvidence(options, whitelist, evidence, seenHashes, seenUrls);
  if (evidence.length >= Number(options.limit || 12)) {
    return evidence;
  }

  const maxQueries = options.mode === "category" ? 24 : 16;
  for (const query of queries.slice(0, maxQueries)) {
    let results = [];
    try {
      results = await searchBing(query);
    } catch {
      continue;
    }
    const rankedResults = results
      .map((item) => ({ ...item, __score: scoreSearchResult(item, { query, gapKeywords: options.gapKeywords, preferredDomains: whitelist }) }))
      .sort((a, b) => b.__score - a.__score);
    for (const item of rankedResults.slice(0, options.mode === "category" ? 10 : 8)) {
      if (!hostMatchesWhitelist(item.url, whitelist)) continue;
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      try {
        const snapshot = await fetchPageSnapshot(item.url, {
          sourceType: options.sourceTypeResolver ? options.sourceTypeResolver(query, item) : "行业公开资料",
          searchQuery: query,
          titleHint: item.title,
          snippet: item.snippet,
        });
        if (!snapshot || !shouldAcceptDomesticEvidence(snapshot, options)) continue;
        if (seenHashes.has(snapshot.sourceHash)) continue;
        seenHashes.add(snapshot.sourceHash);
        evidence.push(snapshot);
        if (evidence.length >= Number(options.limit || 12)) {
          return evidence;
        }
      } catch {
        continue;
      }
    }
  }
  return evidence;
}

module.exports = {
  buildResearchQueries,
  collectDomesticEvidence,
  fetchPageSnapshot,
  hostMatchesWhitelist,
  parseBingResults,
  searchBing,
  stripHtml: evidenceParser.stripHtml,
};
