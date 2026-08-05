const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const iconv = require("iconv-lite");
const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const { getCurrentProjectId } = require("../../common/utils/project-context");
const incubationService = require("../data-lab/data-lab.incubation-runtime");

function queryFirst(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function getProjectScope(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [], projectId: null };
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeCode(value, prefix) {
  const normalized = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `${prefix}_${Date.now().toString().slice(-8)}`;
}

function normalizeAccessPath(value, appCode) {
  const raw = String(value || `/agent/${appCode}`)
    .trim()
    .replace(/\s+/g, "-");

  return `/${raw.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`;
}

function countMojibakeHints(text) {
  const value = String(text || "");
  return ["鍙戝竷", "鐭ヨ瘑", "妫€绱", "璋冭瘯"].reduce(
    (total, token) => total + (value.includes(token) ? 1 : 0),
    0
  );
}

function countEncodingGarbleHints(text) {
  const value = String(text || "");
  const suspiciousTokens = [
    "\u7f03\u6220",
    "\u6d5c\u3086",
    "\u741b\u5c7c",
    "\u9429\u6220",
    "\u599b\u20ac",
    "\u9359\u677f",
    "\u93c1\u677f",
  ];
  return suspiciousTokens.reduce((total, token) => total + (value.includes(token) ? 1 : 0), 0);
}

function scoreDecodedText(text) {
  const value = String(text || "");
  const chinese = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const replacement = (value.match(/�/g) || []).length;
  const mojibake = (value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g) || []).length;
  const printable = (value.match(/[A-Za-z0-9\u4e00-\u9fff，。！？；：、“”‘’（）【】《》、\s._\-/:]/g) || []).length;
  return printable + chinese * 2 - replacement * 5 - mojibake * 3 - countEncodingGarbleHints(value) * 500;
}

function normalizePossibleMojibakeText(text) {
  const raw = String(text || "");
  if (!/[\u0080-\u00ff]/.test(raw)) {
    return raw;
  }
  try {
    const decoded = Buffer.from(raw, "latin1").toString("utf8");
    return scoreDecodedText(decoded) > scoreDecodedText(raw) ? decoded : raw;
  } catch {
    return raw;
  }
}

function isLikelyMojibakeText(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (value.includes("锟")) return true;
  const suspiciousMatches = value.match(/[�寮鍦虹櫧绯荤粺鎻愮ず璇鐭ヨ瘑搴鎺ュ彛妫€绱㈣鍐嶅垱寤鴻嚜涓昏]/g) || [];
  const chineseMatches = value.match(/[\u4e00-\u9fff]/g) || [];
  return suspiciousMatches.length >= 6 && suspiciousMatches.length >= Math.max(6, Math.floor(chineseMatches.length * 0.3));
}

function buildSafeCitationExcerpt(content, parseSummary) {
  const normalizedContent = normalizePossibleMojibakeText(content).trim();
  const normalizedSummary = normalizePossibleMojibakeText(parseSummary).trim();
  if (normalizedContent && !isLikelyMojibakeText(normalizedContent)) {
    return normalizedContent.slice(0, 240);
  }
  if (normalizedSummary && !isLikelyMojibakeText(normalizedSummary)) {
    return normalizedSummary.slice(0, 180);
  }
  return "该知识片段存在编码异常，请回到知识库重新解析该文档。";
}

function normalizeUploadedFileName(fileName) {
  return path.basename(normalizePossibleMojibakeText(fileName)).trim() || "unnamed";
}

function decodeTextBuffer(buffer) {
  const candidates = [
    buffer.toString("utf8"),
    iconv.decode(buffer, "gb18030"),
    iconv.decode(buffer, "gbk"),
  ];
  return candidates.sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0];
}

function splitTextIntoChunks(text, chunkSize = 800) {
  const normalized = String(text || "").replace(/\r/g, "").trim();

  if (!normalized) {
    return ["空文档"];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [normalized.slice(0, chunkSize)];
  }

  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > chunkSize && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [normalized.slice(0, chunkSize)];
}

function extractKeywords(text) {
  return [...new Set(String(text || "").match(/[A-Za-z0-9_\u4e00-\u9fa5]{2,}/g) || [])].slice(0, 16);
}

function buildSearchTerms(text) {
  const value = String(text || "").toLowerCase().trim();
  if (!value) return [];

  const asciiTerms = value.match(/[a-z0-9_]{2,}/g) || [];
  const chineseSegments = value.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const chineseTerms = [];

  chineseSegments.forEach((segment) => {
    chineseTerms.push(segment);
    for (let size = 2; size <= Math.min(6, segment.length); size += 1) {
      for (let index = 0; index <= segment.length - size; index += 1) {
        chineseTerms.push(segment.slice(index, index + size));
      }
    }
  });

  return [...new Set([...asciiTerms, ...chineseTerms])].sort((left, right) => right.length - left.length).slice(0, 40);
}

function buildKeywordScore(text, promptKeywords) {
  const sourceText = String(text || "").toLowerCase();
  return promptKeywords.reduce((total, keyword) => {
    if (!keyword || keyword.length < 2) return total;
    return sourceText.includes(keyword) ? total + Math.min(keyword.length, 8) : total;
  }, 0);
}

function buildRetrievalContext(hits = []) {
  if (!Array.isArray(hits) || hits.length === 0) {
    return "";
  }

  return hits
    .map((item, index) => [
      `# 引用片段 ${index + 1}`,
      `知识库：${item.kbName}`,
      `文件：${item.fileName}`,
      `摘要：${item.parseSummary || "暂无摘要"}`,
      item.content,
    ].join("\n"))
    .join("\n\n");
}

function normalizeRetrievedChunk(row) {
  return {
    id: Number(row.id),
    kbDocId: Number(row.kbDocId),
    kbId: Number(row.kbId),
    kbName: normalizePossibleMojibakeText(row.kbName),
    fileName: normalizePossibleMojibakeText(row.fileName),
    parseSummary: normalizePossibleMojibakeText(row.parseSummary),
    content: normalizePossibleMojibakeText(row.content),
    keywords: safeJsonParse(row.keywords, []),
  };
}

async function listKnowledgeBaseChunks(kbIds = []) {
  const normalizedIds = [...new Set((kbIds || []).map((item) => Number(item)).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return [];
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT chunk.id, chunk.kb_doc_id AS kbDocId, chunk.kb_id AS kbId, chunk.content, chunk.keywords_json AS keywords,
            kb.kb_name AS kbName, doc.file_name AS fileName, doc.parse_summary AS parseSummary
     FROM system_knowledge_base_chunk chunk
     INNER JOIN system_knowledge_base kb ON kb.id = chunk.kb_id
     INNER JOIN system_knowledge_base_document doc ON doc.id = chunk.kb_doc_id
     WHERE chunk.kb_id IN (${placeholders})
     ORDER BY chunk.kb_id ASC, chunk.chunk_index ASC
     LIMIT 500`,
    normalizedIds
  );

  return rows.map(normalizeRetrievedChunk);
}

async function retrieveKnowledgeHits(prompt, kbIds = [], limit = 5) {
  const chunks = await listKnowledgeBaseChunks(kbIds);
  if (chunks.length === 0) {
    return [];
  }

  const promptKeywords = buildSearchTerms(prompt);
  const scored = chunks
    .map((item) => ({
      ...item,
      score: buildKeywordScore(`${item.content}\n${item.parseSummary || ""}\n${(item.keywords || []).join(" ")}`, promptKeywords),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.content.length - right.content.length);

  const selected = (scored.length > 0 ? scored : chunks.slice(0, limit)).slice(0, limit);
  return selected.map((item) => ({
    ...item,
    excerpt: buildSafeCitationExcerpt(item.content, item.parseSummary),
  }));
}

function hasTag(tags, value) {
  return (Array.isArray(tags) ? tags : []).includes(value);
}

function normalizeTagList(tags = []) {
  return [...new Set((Array.isArray(tags) ? tags : []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeSummaryLine(line) {
  return String(line || "")
    .replace(/^\s*[#>*\-\d.、]+\s*/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDocumentParseSummary(fileName, content, chunks) {
  if (scoreDecodedText(content) < 20) {
    return `已解析 ${fileName}，共 ${chunks.length} 个片段`;
  }
  const lines = String(content || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(normalizeSummaryLine)
    .filter(Boolean)
    .filter((line) => line !== "空文档");
  const excerpt = lines.slice(0, 3).join("；").slice(0, 120) || "文档已完成解析";
  const keywords = extractKeywords(content).slice(0, 6).join("、");
  return `摘要：${excerpt}${excerpt.length >= 120 ? "..." : ""}；关键词：${keywords || "无"}；共 ${chunks.length} 个片段`;
}

async function getExistingDocumentChunkContents(documentId) {
  const [rows] = await pool.query(
    `SELECT content
     FROM system_knowledge_base_chunk
     WHERE kb_doc_id = ?
     ORDER BY chunk_index ASC`,
    [documentId]
  );
  return rows.map((row) => row.content).filter(Boolean);
}

function resolveExistingKnowledgeDocumentPath(document) {
  const candidates = [];
  if (document?.filePath) {
    candidates.push(document.filePath);
  }

  const fileName = path.basename(String(document?.fileName || "").trim());
  if (fileName) {
    const generatedDir = path.resolve(__dirname, "../../runtime/system-knowledge-base-generated");
    const uploadDir = path.resolve(__dirname, "../../runtime/system-knowledge-base-uploads");
    [generatedDir, uploadDir].forEach((dirPath) => {
      if (!fs.existsSync(dirPath)) return;
      const matched = fs.readdirSync(dirPath)
        .filter((item) => item.endsWith(fileName))
        .map((item) => path.join(dirPath, item))
        .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
      candidates.push(...matched);
    });
  }

  return candidates.find((item) => item && fs.existsSync(item)) || null;
}

async function readDocumentText(filePath, fileType) {
  const ext = String(fileType || "").toLowerCase();

  if (["txt", "md", "csv", "json", "log"].includes(ext)) {
    const buffer = fs.readFileSync(filePath);
    const utf8Text = buffer.toString("utf8");
    if (!isLikelyMojibakeText(utf8Text)) {
      return utf8Text;
    }
    return decodeTextBuffer(buffer);
  }

  if (ext === "pdf") {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || "";
  }

  if (ext === "docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }

  if (ext === "doc") {
    const WordExtractor = require("word-extractor");
    const extractor = new WordExtractor();
    const document = await extractor.extract(filePath);
    return document.getBody() || "";
  }

  if (["xlsx", "xls"].includes(ext)) {
    const xlsx = require("xlsx");
    const workbook = xlsx.readFile(filePath);
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return `# ${sheetName}\n${xlsx.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
  }

  const stat = fs.statSync(filePath);
  return [
    `文件名：${path.basename(filePath)}`,
    `文件类型：${ext || "unknown"}`,
    `文件大小：${stat.size} bytes`,
    "当前文件类型暂不支持深度解析，已保留原始文件供下载和后续扩展。"
  ].join("\n");
}

async function ensureKnowledgeBaseExists(id) {
  const scoped = getProjectScope("");
  const [rows] = await pool.query(
    `SELECT id, kb_name AS kbName
     FROM system_knowledge_base
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  const row = queryFirst(rows);
  if (!row) {
    throw new AppError("知识库不存在", 404);
  }

  return {
    id: Number(row.id),
    kbName: row.kbName
  };
}

async function ensureKnowledgeBasesExist(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(ids.map((item) => Number(item)).filter(Boolean))];
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const scoped = getProjectScope("");
  const [rows] = await pool.query(
    `SELECT id, kb_name AS kbName
     FROM system_knowledge_base
     WHERE id IN (${placeholders})${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [...uniqueIds, ...scoped.params]
  );

  if (rows.length !== uniqueIds.length) {
    throw new AppError("部分知识库不存在或已删除", 400);
  }

  return rows.map((row) => ({
    id: Number(row.id),
    kbName: row.kbName
  }));
}

async function getKnowledgeBaseDocuments(kbId) {
  const [rows] = await pool.query(
    `SELECT id, kb_id AS kbId, file_name AS fileName, file_type AS fileType, file_path AS filePath,
            file_size AS fileSize, parse_status AS parseStatus, parse_summary AS parseSummary,
            vector_status AS vectorStatus, doc_status AS docStatus, chunk_count AS chunkCount,
            last_parsed_at AS lastParsedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM system_knowledge_base_document
     WHERE kb_id = ?
     ORDER BY updated_at DESC, id DESC`,
    [kbId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    kbId: Number(row.kbId),
    fileName: normalizePossibleMojibakeText(row.fileName),
    fileType: row.fileType,
    filePath: row.filePath,
    fileSize: Number(row.fileSize || 0),
    parseStatus: row.parseStatus,
    parseSummary: normalizePossibleMojibakeText(row.parseSummary),
    vectorStatus: row.vectorStatus,
    docStatus: row.docStatus,
    chunkCount: Number(row.chunkCount || 0),
    lastParsedAt: row.lastParsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function getKnowledgeBaseDetail(id) {
  const scoped = getProjectScope("");
  const [rows] = await pool.query(
    `SELECT id, kb_name AS kbName, kb_desc AS kbDesc, tags_json AS tags,
            status, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM system_knowledge_base
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  const kb = queryFirst(rows);
  if (!kb) {
    throw new AppError("知识库不存在", 404);
  }

  const documents = await getKnowledgeBaseDocuments(id);

  return {
    id: Number(kb.id),
    kbName: normalizePossibleMojibakeText(kb.kbName),
    kbDesc: normalizePossibleMojibakeText(kb.kbDesc),
    tags: safeJsonParse(kb.tags, []),
    status: kb.status,
    createdBy: kb.createdBy,
    documentCount: documents.length,
    createdAt: kb.createdAt,
    updatedAt: kb.updatedAt,
    documents
  };
}

async function listKnowledgeBases() {
  const scoped = getProjectScope("kb");
  const [rows] = await pool.query(
    `SELECT kb.id, kb.kb_name AS kbName, kb.kb_desc AS kbDesc, kb.tags_json AS tags,
            kb.status, kb.created_by AS createdBy, kb.created_at AS createdAt, kb.updated_at AS updatedAt,
            COUNT(doc.id) AS documentCount
     FROM system_knowledge_base kb
     LEFT JOIN system_knowledge_base_document doc ON doc.kb_id = kb.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY kb.id, kb.kb_name, kb.kb_desc, kb.tags_json, kb.status, kb.created_by, kb.created_at, kb.updated_at
     ORDER BY kb.updated_at DESC, kb.id DESC`,
    scoped.params
  );

  return rows.map((row) => ({
    id: Number(row.id),
    kbName: normalizePossibleMojibakeText(row.kbName),
    kbDesc: normalizePossibleMojibakeText(row.kbDesc),
    tags: safeJsonParse(row.tags, []),
    status: row.status,
    createdBy: row.createdBy,
    documentCount: Number(row.documentCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function findKnowledgeBaseByTags(tags = []) {
  const normalized = normalizeTagList(tags);
  if (!normalized.length) {
    return null;
  }
  const all = await listKnowledgeBases();
  return all.find((item) => {
    const itemTags = normalizeTagList(item.tags || []);
    return itemTags.length === normalized.length && normalized.every((tag) => hasTag(itemTags, tag));
  }) || null;
}

async function createKnowledgeBase(payload, user) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO system_knowledge_base (project_id, kb_name, kb_desc, tags_json, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.kbName,
      payload.kbDesc || null,
      JSON.stringify(payload.tags || []),
      payload.status || "active",
      user?.displayName || user?.username || "system"
    ]
  );

  return getKnowledgeBaseDetail(result.insertId);
}

async function createOrUpdateKnowledgeBaseByTags(payload, user) {
  const existing = await findKnowledgeBaseByTags(payload.tags || []);
  if (existing) {
    return updateKnowledgeBase(existing.id, payload);
  }
  return createKnowledgeBase(payload, user);
}

async function updateKnowledgeBase(id, payload) {
  await ensureKnowledgeBaseExists(id);
  const scoped = getProjectScope("");

  await pool.query(
    `UPDATE system_knowledge_base
     SET kb_name = ?, kb_desc = ?, tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.kbName,
      payload.kbDesc || null,
      JSON.stringify(payload.tags || []),
      payload.status || "active",
      id,
      ...scoped.params
    ]
  );

  return getKnowledgeBaseDetail(id);
}

async function deleteKnowledgeBase(id) {
  const detail = await getKnowledgeBaseDetail(id);

  for (const document of detail.documents || []) {
    if (document.filePath && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }
  }

  const scoped = getProjectScope("");
  await pool.query(
    `DELETE FROM system_knowledge_base WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return { id };
}

async function getKnowledgeDocumentById(documentId) {
  const [rows] = await pool.query(
    `SELECT id, kb_id AS kbId, file_name AS fileName, file_type AS fileType, file_path AS filePath,
            file_size AS fileSize, parse_status AS parseStatus, parse_summary AS parseSummary,
            vector_status AS vectorStatus, doc_status AS docStatus, chunk_count AS chunkCount,
            last_parsed_at AS lastParsedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM system_knowledge_base_document
     WHERE id = ?
     LIMIT 1`,
    [documentId]
  );

  const row = queryFirst(rows);
  if (!row) {
    throw new AppError("知识库文件不存在", 404);
  }

  return {
    id: Number(row.id),
    kbId: Number(row.kbId),
    fileName: normalizePossibleMojibakeText(row.fileName),
    fileType: row.fileType,
    filePath: row.filePath,
    fileSize: Number(row.fileSize || 0),
    parseStatus: row.parseStatus,
    parseSummary: normalizePossibleMojibakeText(row.parseSummary),
    vectorStatus: row.vectorStatus,
    docStatus: row.docStatus,
    chunkCount: Number(row.chunkCount || 0),
    lastParsedAt: row.lastParsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function getKnowledgeDocumentPreview(documentId) {
  const document = await getKnowledgeDocumentById(documentId);
  const [rows] = await pool.query(
    `SELECT id, chunk_index AS chunkIndex, content, keywords_json AS keywords, created_at AS createdAt
     FROM system_knowledge_base_chunk
     WHERE kb_doc_id = ?
     ORDER BY chunk_index ASC
     LIMIT 50`,
    [documentId]
  );

  const chunks = rows.map((row) => ({
    id: Number(row.id),
    chunkIndex: Number(row.chunkIndex || 0),
    content: normalizePossibleMojibakeText(row.content),
    keywords: safeJsonParse(row.keywords, []),
    createdAt: row.createdAt
  }));

  let previewSource = chunks.length > 0 ? "chunks" : "file";
  let previewText = chunks.map((item) => item.content).join("\n\n");

  if (!previewText) {
    try {
      const resolvedPath = resolveExistingKnowledgeDocumentPath(document);
      if (!resolvedPath) {
        throw new AppError("原始文件不存在，且暂无可预览的解析片段", 404);
      }
      previewText = await readDocumentText(resolvedPath, document.fileType);
    } catch (error) {
      previewSource = "summary";
      previewText = document.parseSummary || error.message || "暂无可预览内容";
    }
  }

  const maxPreviewLength = 20000;
  return {
    document,
    chunks,
    totalChunks: Number(document.chunkCount || chunks.length || 0),
    previewSource,
    previewText: String(previewText || "").slice(0, maxPreviewLength),
    truncated: String(previewText || "").length > maxPreviewLength
  };
}

async function uploadKnowledgeDocument(kbId, file) {
  await ensureKnowledgeBaseExists(kbId);

  if (!file) {
    throw new AppError("请上传知识库文件", 400);
  }

  const normalizedFileName = normalizeUploadedFileName(file.originalname);
  const fileType = path.extname(normalizedFileName).replace(/^\./, "").toLowerCase() || "bin";
  const [result] = await pool.query(
    `INSERT INTO system_knowledge_base_document
      (kb_id, file_name, file_type, file_path, file_size, parse_status, vector_status, doc_status)
     VALUES (?, ?, ?, ?, ?, 'WAIT_PARSE', 'PENDING', 'active')`,
    [kbId, normalizedFileName, fileType, file.path, file.size]
  );

  void reparseKnowledgeDocument(result.insertId).catch((error) => {
    console.error("[agent-platform] knowledge document parse failed:", error);
  });

  return getKnowledgeBaseDetail(kbId);
}

async function upsertGeneratedKnowledgeDocument(kbId, fileName, content) {
  await ensureKnowledgeBaseExists(kbId);
  const normalizedFileName = normalizeUploadedFileName(fileName);
  const generatedDir = path.resolve(__dirname, "../../runtime/system-knowledge-base-generated");
  fs.mkdirSync(generatedDir, { recursive: true });
  const filePath = path.join(generatedDir, `${Date.now()}-${normalizedFileName}`);
  fs.writeFileSync(filePath, content, "utf8");

  const [rows] = await pool.query(
    `SELECT id
     FROM system_knowledge_base_document
     WHERE kb_id = ?
       AND file_name = ?
     ORDER BY id DESC
     LIMIT 1`,
    [kbId, normalizedFileName]
  );
  const existing = queryFirst(rows);
  let documentId = existing ? Number(existing.id) : null;

  if (documentId) {
    await pool.query(
      `UPDATE system_knowledge_base_document
       SET file_path = ?, file_size = ?, parse_status = 'WAIT_PARSE', vector_status = 'PENDING', doc_status = 'active'
       WHERE id = ?`,
      [filePath, Buffer.byteLength(content, "utf8"), documentId]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO system_knowledge_base_document
        (kb_id, file_name, file_type, file_path, file_size, parse_status, vector_status, doc_status)
       VALUES (?, ?, 'md', ?, ?, 'WAIT_PARSE', 'PENDING', 'active')`,
      [kbId, normalizedFileName, filePath, Buffer.byteLength(content, "utf8")]
    );
    documentId = Number(result.insertId);
  }

  await reparseKnowledgeDocument(documentId);
  return getKnowledgeDocumentById(documentId);
}

function buildIncubationCategoryKnowledgeDocument(incubation, category, stats, publicDictionaries = []) {
  const categoryStats = (stats?.categories || []).find((item) => item.categoryCode === category.categoryCode);
  const standardAssets = safeJsonParse(incubation.standardAssets, incubation.standardAssets || {});
  const dictionaries = Array.isArray(standardAssets?.dictionaries)
    ? standardAssets.dictionaries.filter((item) => item?.categoryCode === category.categoryCode)
    : [];
  const fieldSemantics = Array.isArray(standardAssets?.fieldSemantics) ? standardAssets.fieldSemantics : [];
  const tableDetails = Array.isArray(category.tableDetails) ? category.tableDetails : [];
  const enrichedTableDetails = tableDetails.map((item) => {
    const semanticFields = fieldSemantics
      .filter((entry) => String(entry?.tableName || "").trim() === String(item?.tableName || "").trim())
      .map((entry) => String(entry?.fieldLabel || entry?.fieldName || "").trim())
      .filter(Boolean);
    return {
      ...item,
      keyInfoItems: Array.from(new Set([...(Array.isArray(item?.keyInfoItems) ? item.keyInfoItems : []), ...semanticFields])),
    };
  });
  const dictionaryGroups = new Map();
  dictionaries.forEach((item) => {
    const dictType = String(item?.dictType || "").trim();
    if (!dictType) return;
    if (!dictionaryGroups.has(dictType)) {
      dictionaryGroups.set(dictType, []);
    }
    dictionaryGroups.get(dictType).push(item);
  });
  const publicGroupMap = new Map();
  (Array.isArray(publicDictionaries) ? publicDictionaries : []).forEach((item) => {
    publicGroupMap.set(item.dictType, item);
  });
  return [
    `# ${category.categoryName}`,
    "",
    `行业：${incubation.incubationName}`,
    `行业编码：${incubation.industryCode}`,
    `子类目编码：${category.categoryCode}`,
    `最近轮次：${categoryStats?.lastRoundNo || category.lastRoundNo || 0}`,
    "",
    "## 业务说明",
    category.description || "暂无说明",
    "",
    "## 表信息清单",
    ...(enrichedTableDetails.length > 0 ? enrichedTableDetails.flatMap((item) => [
      `### ${item.tableName}`,
      `- 表描述：${item.tableComment || "暂无"}`,
      `- 表摘要：${item.tableSummary || item.summary || item.tableComment || "暂无"}`,
      `- 关键信息项：${Array.isArray(item.keyInfoItems) && item.keyInfoItems.length > 0 ? item.keyInfoItems.join("、") : "暂无"}`,
      "",
    ]) : ["- 暂无表信息", ""]),
    "",
    "## 子类目字典表",
    ...Array.from(dictionaryGroups.entries()).flatMap(([dictType, items]) => [
      `### ${dictType} / ${String(items[0]?.itemValue?.dictName || items[0]?.dictName || dictType).trim() || dictType}`,
      ...items.map((item) => `- ${item.itemCode}: ${item.itemLabel}${item?.itemValue?.valueRange ? ` (${item.itemValue.valueRange})` : ""}`),
      "",
    ]),
    "## 行业公共字典表",
    ...Array.from(publicGroupMap.values()).map((item) => `- ${item.dictType} / ${item.dictName || item.dictType} / ${item.itemCount} 项`),
    "",
    "## 统计摘要",
    `- 表数：${categoryStats?.tableCount || 0}`,
    `- 字典表数：${categoryStats?.dictionaryGroupCount || 0}`,
    `- 字典项数：${categoryStats?.dictionaryItemCount || 0}`,
    `- 证据数：${categoryStats?.evidenceCount || 0}`,
    "",
  ].join("\n");
}

function buildIncubationIndustryKnowledgeDocument(incubation, stats) {
  const categories = Array.isArray(incubation?.standardAssets?.researchCatalog?.categoryTree)
    ? incubation.standardAssets.researchCatalog.categoryTree
    : [];
  return [
    `# ${incubation.incubationName} 行业知识库`,
    "",
    `行业编码：${incubation.industryCode}`,
    `配置编码：${incubation.incubationCode}`,
    "",
    "## 行业说明",
    incubation.incubationDesc || "暂无说明",
    "",
    "## 统计摘要",
    `- 子类目数：${stats?.totals?.categoryCount || 0}`,
    `- 表数：${stats?.totals?.tableCount || 0}`,
    `- 字典表数：${stats?.totals?.dictionaryGroupCount || 0}`,
    `- 字典项数：${stats?.totals?.dictionaryItemCount || 0}`,
    `- 公共字典表数：${stats?.totals?.publicDictionaryGroupCount || 0}`,
    `- 公共字典项数：${stats?.totals?.publicDictionaryItemCount || 0}`,
    "",
    "## 子类目目录",
    ...((stats?.categories || []).map((item) => `- ${item.categoryName} / ${item.categoryCode} / ${item.tableCount} 表 / ${item.dictionaryGroupCount} 字典表 / ${item.dictionaryItemCount} 字典项`)),
    "",
    "## 子类目表信息摘要",
    ...categories.flatMap((item) => {
      const categoryName = String(item?.categoryName || item?.categoryCode || "").trim();
      const tableDetails = Array.isArray(item?.tableDetails) ? item.tableDetails : [];
      if (!categoryName) return [];
      return [
        `### ${categoryName}`,
        ...(tableDetails.length > 0
          ? tableDetails.map((table) => `- ${table.tableName}${table.tableSummary ? ` / ${table.tableSummary}` : table.tableComment ? ` / ${table.tableComment}` : ""}`)
          : ["- 暂无表信息"]),
        "",
      ];
    }),
    "",
  ].join("\n");
}

async function syncIncubationKnowledgeBase(incubationId, payload = {}, user) {
  const incubation = await incubationService.getIndustryIncubationDetail(Number(incubationId));
  const stats = await incubationService.getIndustryIncubationStats(Number(incubationId));
  const categoryCode = String(payload.categoryCode || "").trim() || null;
  const targetCategory = categoryCode
    ? (Array.isArray(stats.categories) ? stats.categories.find((item) => item.categoryCode === categoryCode) : null)
    : null;
  if (categoryCode && !targetCategory) {
    throw new AppError("目标子类目不存在", 404);
  }

  const industryKb = await createOrUpdateKnowledgeBaseByTags({
    kbName: `${incubation.incubationName}行业知识库`,
    kbDesc: incubation.incubationDesc || `${incubation.incubationName}行业孵化结构化知识`,
    tags: normalizeTagList(["scope:industry", `incubation:${incubation.id}`, `industry:${incubation.industryCode}`]),
    status: "active",
  }, user);
  await upsertGeneratedKnowledgeDocument(
    industryKb.id,
    `${incubation.incubationCode}_industry.md`,
    buildIncubationIndustryKnowledgeDocument(incubation, stats)
  );

  if (!targetCategory) {
    return {
      scope: "industry",
      knowledgeBase: await getKnowledgeBaseDetail(industryKb.id),
    };
  }

  const categoryRecord = (Array.isArray(incubation.standardAssets?.researchCatalog?.categoryTree)
    ? incubation.standardAssets.researchCatalog.categoryTree
    : []).find((item) => String(item?.categoryCode || "").trim() === targetCategory.categoryCode);
  const categoryKb = await createOrUpdateKnowledgeBaseByTags({
    kbName: `${incubation.incubationName} / ${targetCategory.categoryName}`,
    kbDesc: `${targetCategory.categoryName}子类目结构化知识`,
    tags: normalizeTagList([
      "scope:industry",
      "scope:industry_category",
      `incubation:${incubation.id}`,
      `industry:${incubation.industryCode}`,
      `category:${targetCategory.categoryCode}`,
      `parentKb:${industryKb.id}`,
    ]),
    status: "active",
  }, user);
  await upsertGeneratedKnowledgeDocument(
    categoryKb.id,
    `${incubation.incubationCode}_${targetCategory.categoryCode}.md`,
    buildIncubationCategoryKnowledgeDocument(incubation, categoryRecord || targetCategory, stats, stats.publicDictionaries)
  );
  return {
    scope: "category",
    industryKnowledgeBase: await getKnowledgeBaseDetail(industryKb.id),
    knowledgeBase: await getKnowledgeBaseDetail(categoryKb.id),
  };
}

async function reparseKnowledgeDocument(documentId) {
  const document = await getKnowledgeDocumentById(documentId);
  const normalizedDocumentName = normalizeUploadedFileName(document.fileName);

  await pool.query(
    `UPDATE system_knowledge_base_document
     SET parse_status = 'PARSING', parse_summary = '文档解析中', vector_status = 'PENDING'
     WHERE id = ?`,
    [documentId]
  );

  try {
    let content;
    try {
      const resolvedPath = resolveExistingKnowledgeDocumentPath(document);
      if (!resolvedPath) {
        const missingError = new Error(`document file missing: ${document.filePath}`);
        missingError.code = "ENOENT";
        throw missingError;
      }
      if (resolvedPath !== document.filePath) {
        await pool.query(
          `UPDATE system_knowledge_base_document
           SET file_path = ?
           WHERE id = ?`,
          [resolvedPath, documentId]
        );
      }
      content = await readDocumentText(resolvedPath, document.fileType);
    } catch (readError) {
      if (readError.code === "ENOENT") {
        const cachedChunks = await getExistingDocumentChunkContents(documentId);
        if (cachedChunks.length > 0) {
          content = cachedChunks.join("\n");
        } else {
          throw readError;
        }
      } else {
        throw readError;
      }
    }
    const chunks = splitTextIntoChunks(content);
    const parseSummary = buildDocumentParseSummary(normalizedDocumentName, content, chunks);

    await pool.query("DELETE FROM system_knowledge_base_chunk WHERE kb_doc_id = ?", [documentId]);

    for (let index = 0; index < chunks.length; index += 1) {
      await pool.query(
        `INSERT INTO system_knowledge_base_chunk (kb_doc_id, kb_id, chunk_index, content, keywords_json)
         VALUES (?, ?, ?, ?, ?)`,
        [documentId, document.kbId, index + 1, chunks[index], JSON.stringify(extractKeywords(chunks[index]))]
      );
    }

    await pool.query(
      `UPDATE system_knowledge_base_document
       SET parse_status = 'PARSE_SUCCESS',
           parse_summary = ?,
           vector_status = 'READY',
           chunk_count = ?,
           last_parsed_at = NOW()
       WHERE id = ?`,
      [parseSummary, chunks.length, documentId]
    );
  } catch (error) {
    await pool.query(
      `UPDATE system_knowledge_base_document
       SET parse_status = 'PARSE_FAIL',
           parse_summary = ?,
           vector_status = 'FAILED',
           last_parsed_at = NOW()
       WHERE id = ?`,
      [error.message || "文档解析失败", documentId]
    );

    throw error;
  }

  return getKnowledgeBaseDetail(document.kbId);
}

async function deleteKnowledgeDocument(documentId) {
  const document = await getKnowledgeDocumentById(documentId);

  await pool.query("DELETE FROM system_knowledge_base_document WHERE id = ?", [documentId]);

  if (document.filePath && fs.existsSync(document.filePath)) {
    fs.unlinkSync(document.filePath);
  }

  return { id: documentId, kbId: document.kbId };
}


module.exports = {
  listKnowledgeBases,
  getKnowledgeBaseDetail,
  createKnowledgeBase,
  createOrUpdateKnowledgeBaseByTags,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  uploadKnowledgeDocument,
  upsertGeneratedKnowledgeDocument,
  reparseKnowledgeDocument,
  getKnowledgeDocumentPreview,
  getKnowledgeDocumentById,
  deleteKnowledgeDocument,
  syncIncubationKnowledgeBase,
};
