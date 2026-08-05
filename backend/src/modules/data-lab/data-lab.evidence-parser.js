const crypto = require("crypto");
const path = require("path");
const iconv = require("iconv-lite");
const { extractPdfTextFromBuffer } = require("./data-lab.pdf-extractor");

const MAX_SNAPSHOT_LENGTH = 16000;
const GOV_HOST_RE = /(^|\.)gov\.cn$/i;
const EDU_HOST_RE = /(^|\.)edu\.cn$/i;
const ORG_HOST_RE = /(^|\.)org\.cn$/i;
const PDF_CONTENT_RE = /(^application\/pdf\b)|(^application\/octet-stream\b)/i;

const FOREIGN_TERM_PATTERNS = [
  /\b(?:GDPR|HIPAA|FDA|IRS|NHS|PCI-DSS|Amazon|Walmart|eBay|Uber|FedEx)\b/gi,
];
const FOREIGN_REGION_PATTERNS = [
  /(?:美国|英国|欧盟|德国|法国|日本|韩国|新加坡|纽约|伦敦|东京|首尔)/g,
  /\b(?:USA|United States|UK|EU|Germany|France|Japan|Korea|Singapore|New York|London|Tokyo|Seoul)\b/gi,
];
const NON_CNY_CURRENCY_PATTERNS = [
  /(?:美元|欧元|英镑|日元|港币)/g,
  /\b(?:USD|EUR|GBP|JPY|HKD|AUD|CAD|SGD)\b/gi,
];

function scoreDecodedText(text) {
  const value = String(text || "");
  const chinese = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const replacement = (value.match(/�/g) || []).length;
  const mojibake = (value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g) || []).length;
  const printable = (value.match(/[A-Za-z0-9\u4e00-\u9fff，。！？；：、“”‘’（）【】《》、\s._\-/:]/g) || []).length;
  return printable + chinese * 2 - replacement * 5 - mojibake * 3;
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html) {
  return decodeHtmlEntities(String(html || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(text, maxLength = MAX_SNAPSHOT_LENGTH) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function decodeBuffer(buffer, contentType = "") {
  const contentTypeCharset = String(contentType || "").match(/charset=([^;]+)/i)?.[1]?.trim();
  const preferredDecodes = [];
  if (contentTypeCharset && iconv.encodingExists(contentTypeCharset)) {
    try {
      preferredDecodes.push(iconv.decode(buffer, contentTypeCharset));
    } catch {
      // ignore
    }
  }
  const headText = buffer.toString("latin1", 0, Math.min(buffer.length, 2048));
  const metaCharset = headText.match(/charset=["']?([a-zA-Z0-9_-]+)/i)?.[1]?.trim();
  if (metaCharset && iconv.encodingExists(metaCharset)) {
    try {
      preferredDecodes.push(iconv.decode(buffer, metaCharset));
    } catch {
      // ignore
    }
  }
  const preferred = preferredDecodes.find((item) => scoreDecodedText(item) > 60);
  if (preferred) {
    return preferred;
  }
  const candidates = [];
  candidates.push(buffer.toString("utf8"));
  if (iconv.encodingExists("gb18030")) {
    candidates.push(iconv.decode(buffer, "gb18030"));
  }
  if (iconv.encodingExists("gbk")) {
    candidates.push(iconv.decode(buffer, "gbk"));
  }
  return candidates.sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0] || "";
}

function extractMetaContent(html, keys = []) {
  for (const key of keys) {
    const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
    const matched = String(html || "").match(pattern);
    if (matched?.[1]) {
      return decodeHtmlEntities(matched[1]).trim();
    }
  }
  return "";
}

function extractHtmlTitle(html, titleHint = "") {
  const candidates = [
    extractMetaContent(html, ["og:title", "article:title"]),
    String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
    String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
    titleHint,
  ];
  return candidates
    .map((item) => stripHtml(item))
    .find((item) => item && item.length >= 2) || "";
}

function normalizeDateValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const compact = raw
    .replace(/[年/.]/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, " ")
    .replace(/[时]/g, ":")
    .replace(/[分]/g, ":")
    .replace(/[秒]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const matched = compact.match(/(20\d{2}-\d{1,2}-\d{1,2})(?:[ T](\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
  if (!matched) {
    return null;
  }
  const datePart = matched[1].split("-").map((item) => item.padStart(2, "0"));
  const timePart = String(matched[2] || "00:00:00")
    .split(":")
    .map((item) => item.padStart(2, "0"));
  while (timePart.length < 3) timePart.push("00");
  const iso = `${datePart[0]}-${datePart[1]}-${datePart[2]}T${timePart[0]}:${timePart[1]}:${timePart[2]}+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractPublishedAt(html, text) {
  const metaCandidates = [
    extractMetaContent(html, ["article:published_time", "publishdate", "pubdate", "dc.date", "date", "weibo: article:create_at"]),
    String(html || "").match(/(?:发布时间|发布日期|成文日期|公开时间)[^0-9]{0,8}((?:20\d{2}[年\/.-]\d{1,2}[月\/.-]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?))/)?.[1] || "",
    String(text || "").match(/(?:发布时间|发布日期|成文日期|公开时间)[^0-9]{0,8}((?:20\d{2}[年\/.-]\d{1,2}[月\/.-]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?))/)?.[1] || "",
    String(text || "").match(/((?:20\d{2}[年\/.-]\d{1,2}[月\/.-]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?))/)?.[1] || "",
  ];
  return metaCandidates.map(normalizeDateValue).find(Boolean) || null;
}

function extractHtmlMainText(html) {
  const candidates = [
    String(html || "").match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || "",
    String(html || "").match(/<(div|section)[^>]+(?:id|class)=["'][^"']*(?:content|article|main|detail|正文)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i)?.[2] || "",
    html,
  ];
  for (const candidate of candidates) {
    const cleaned = cleanText(
      decodeHtmlEntities(String(candidate || ""))
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/section>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    );
    if (cleaned.length >= 120) {
      return cleaned;
    }
  }
  return cleanText(stripHtml(html));
}

function normalizeAuthority(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

function analyzeDomesticBoundary(text) {
  const value = String(text || "");
  const foreignTermHitCount = FOREIGN_TERM_PATTERNS.reduce((sum, pattern) => sum + (value.match(pattern) || []).length, 0);
  const foreignRegionHitCount = FOREIGN_REGION_PATTERNS.reduce((sum, pattern) => sum + (value.match(pattern) || []).length, 0);
  const nonCnyCurrencyHitCount = NON_CNY_CURRENCY_PATTERNS.reduce((sum, pattern) => sum + (value.match(pattern) || []).length, 0);
  return {
    domesticContextOnly: foreignTermHitCount === 0 && foreignRegionHitCount === 0 && nonCnyCurrencyHitCount === 0,
    foreignTermHitCount,
    foreignRegionHitCount,
    nonCnyCurrencyHitCount,
  };
}

function buildEvidenceHash({ sourceUrl, title, publishedAt, snapshotContent }) {
  return crypto
    .createHash("sha1")
    .update([sourceUrl, title, publishedAt || "", snapshotContent || ""].join("||"))
    .digest("hex");
}

function computeEvidenceConfidence({ authority, publishedAt, snapshotContent, title, domesticBoundary, contentType }) {
  let score = 0.2;
  if (GOV_HOST_RE.test(authority)) score += 0.4;
  else if (EDU_HOST_RE.test(authority)) score += 0.28;
  else if (ORG_HOST_RE.test(authority)) score += 0.18;
  else score += 0.08;
  if (publishedAt) score += 0.1;
  if (String(snapshotContent || "").length >= 1200) score += 0.1;
  else if (String(snapshotContent || "").length >= 400) score += 0.05;
  if (String(title || "").trim()) score += 0.05;
  if (PDF_CONTENT_RE.test(String(contentType || "")) || /\.pdf(?:$|\?)/i.test(String(contentType || ""))) score += 0.05;
  if (domesticBoundary.domesticContextOnly) score += 0.05;
  else score -= 0.15;
  return Number(Math.max(0.05, Math.min(0.99, score)).toFixed(2));
}

function buildEvidenceFromText({
  url,
  title,
  titleHint,
  snippet,
  sourceType,
  searchQuery,
  fetchedAt,
  snapshotContent,
  publishedAt,
  contentType,
}) {
  const authority = normalizeAuthority(url);
  const normalizedTitle = cleanText(title || titleHint, 256) || path.basename(String(url || "").split("?")[0] || "evidence");
  const normalizedContent = cleanText(snapshotContent || "");
  if (normalizedContent.length < 80) {
    return null;
  }
  const domesticBoundary = analyzeDomesticBoundary(`${normalizedTitle}\n${normalizedContent}`);
  const sourceHash = buildEvidenceHash({
    sourceUrl: url,
    title: normalizedTitle,
    publishedAt,
    snapshotContent: normalizedContent,
  });
  const confidence = computeEvidenceConfidence({
    authority,
    publishedAt,
    snapshotContent: normalizedContent,
    title: normalizedTitle,
    domesticBoundary,
    contentType,
  });
  return {
    id: `evd_${sourceHash.slice(0, 16)}`,
    sourceHash,
    sourceUrl: url,
    title: normalizedTitle,
    authority,
    publishedAt,
    snapshotContent: normalizedContent,
    summary: cleanText(snippet || normalizedContent, 240),
    confidence,
    sourceType: String(sourceType || "行业公开资料").trim() || "行业公开资料",
    searchQuery: String(searchQuery || "").trim(),
    contentType: String(contentType || "").trim(),
    fetchedAt: fetchedAt || new Date().toISOString(),
    ...domesticBoundary,
  };
}

async function parseFetchedEvidence({
  url,
  responseUrl,
  contentType,
  buffer,
  sourceType,
  searchQuery,
  fetchedAt,
  titleHint,
  snippet,
}) {
  const resolvedUrl = responseUrl || url;
  const normalizedContentType = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (normalizedContentType === "application/pdf" || /\.pdf(?:$|\?)/i.test(resolvedUrl)) {
    const pdf = await extractPdfTextFromBuffer(buffer);
    return buildEvidenceFromText({
      url: resolvedUrl,
      title: pdf.info?.Title || titleHint,
      titleHint,
      snippet,
      sourceType,
      searchQuery,
      fetchedAt,
      snapshotContent: pdf.text,
      publishedAt: pdf.publishedAt || null,
      contentType: normalizedContentType || "application/pdf",
    });
  }

  const html = decodeBuffer(buffer, contentType);
  const title = extractHtmlTitle(html, titleHint);
  const snapshotContent = extractHtmlMainText(html);
  const publishedAt = extractPublishedAt(html, `${title}\n${snapshotContent}`);
  return buildEvidenceFromText({
    url: resolvedUrl,
    title,
    titleHint,
    snippet,
    sourceType,
    searchQuery,
    fetchedAt,
    snapshotContent,
    publishedAt,
    contentType: normalizedContentType || "text/html",
  });
}

module.exports = {
  analyzeDomesticBoundary,
  buildEvidenceHash,
  cleanText,
  computeEvidenceConfidence,
  decodeHtmlEntities,
  extractHtmlMainText,
  extractHtmlTitle,
  extractPublishedAt,
  normalizeAuthority,
  parseFetchedEvidence,
  stripHtml,
};
