const xlsx = require("xlsx");
const iconv = require("iconv-lite");
const xmlJs = require("xml-js");

const DEFAULT_PREVIEW_LIMIT = 50;
const FIELD_SAMPLE_LIMIT = 50;
const PREVIEW_SAMPLE_ROW_LIMIT = 100;

function decodeBuffer(buffer, encoding = "utf8") {
  const normalized = String(encoding || "utf8").trim().toLowerCase();
  if (normalized && normalized !== "utf8" && normalized !== "utf-8") {
    try {
      return iconv.decode(buffer, normalized);
    } catch (_error) {
    }
  }
  return Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer || "");
}

function detectFileType(fileName = "") {
  const matched = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched ? matched[1] : "";
}

function guessDelimiter(text = "") {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  const candidates = [",", "\t", "|", ";"];
  let best = ",";
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = lines.reduce((total, line) => total + line.split(candidate).length - 1, 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function forEachDelimitedLine(text, callback) {
  let lineStart = 0;
  let lineNumber = 0;
  for (let index = 0; index <= text.length; index += 1) {
    const atEnd = index === text.length;
    const char = atEnd ? "\n" : text[index];
    if (char !== "\n" && !atEnd) {
      continue;
    }
    const lineEnd = index > lineStart && text[index - 1] === "\r" ? index - 1 : index;
    const line = text.slice(lineStart, lineEnd);
    if (!(atEnd && line === "" && lineStart === text.length)) {
      callback(line, lineNumber);
      lineNumber += 1;
    }
    lineStart = index + 1;
  }
}

function parseDelimitedLine(line, delimiter = ",", quoteChar = "\"") {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === quoteChar && inQuotes && next === quoteChar) {
      current += quoteChar;
      index += 1;
      continue;
    }

    if (char === quoteChar) {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);

  return {
    values,
    inQuotes,
  };
}

function isEmptyValue(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalizeHeader(value, index) {
  const text = String(value ?? "").trim();
  return text || `field_${index + 1}`;
}

function ensureUniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((item) => {
    const base = String(item || "").trim() || "field";
    const current = seen.get(base) || 0;
    seen.set(base, current + 1);
    return current === 0 ? base : `${base}_${current + 1}`;
  });
}

function normalizeScalarValue(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function matrixToStructuredRows(matrix, options = {}) {
  const headerRowNumber = Math.max(1, Number(options.headerRowNumber || 1));
  const fieldNameMode = String(options.fieldNameMode || "header").toLowerCase();
  const firstDataRowNumber = Math.max(
    1,
    Number(
      options.firstDataRowNumber
      || (fieldNameMode === "header" ? headerRowNumber + 1 : 1)
    )
  );
  const rows = Array.isArray(matrix) ? matrix : [];
  const width = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
  const rawHeaders = fieldNameMode === "header"
    ? Array.from({ length: width }, (_, index) => normalizeHeader(rows[headerRowNumber - 1]?.[index], index))
    : Array.from({ length: width }, (_, index) => `field_${index + 1}`);
  const headers = ensureUniqueHeaders(rawHeaders);
  const records = [];

  for (let rowIndex = firstDataRowNumber - 1; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const normalizedRow = headers.reduce((result, header, columnIndex) => {
      result[header] = normalizeScalarValue(row[columnIndex]);
      return result;
    }, {});

    const allEmpty = Object.values(normalizedRow).every((value) => isEmptyValue(value));
    if (allEmpty) {
      continue;
    }

    records.push({
      __rowNo: rowIndex + 1,
      ...normalizedRow,
    });
  }

  return {
    headers,
    rows: records,
  };
}

function objectRowsToStructuredRows(rows = []) {
  const headers = ensureUniqueHeaders(
    Array.from(
      rows.reduce((set, row) => {
        Object.keys(row || {}).forEach((key) => set.add(key));
        return set;
      }, new Set())
    )
  );

  const records = rows
    .map((row, index) => headers.reduce((result, header) => {
      result[header] = normalizeScalarValue(row?.[header]);
      return result;
    }, { __rowNo: index + 1 }))
    .filter((row) => Object.entries(row).some(([key, value]) => key !== "__rowNo" && !isEmptyValue(value)));

  return {
    headers,
    rows: records,
  };
}

function inferValueType(value) {
  if (value === null || value === undefined || value === "") {
    return "null";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "decimal";
  }

  const text = String(value).trim();
  if (!text) {
    return "null";
  }
  if (/^(true|false)$/i.test(text)) {
    return "boolean";
  }
  if (/^-?\d+$/.test(text)) {
    return "integer";
  }
  if (/^-?\d+\.\d+$/.test(text)) {
    return "decimal";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "date";
  }
  if (/^\d{4}-\d{2}-\d{2}[ tT]\d{2}:\d{2}(:\d{2})?/.test(text)) {
    return "datetime";
  }
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    return "json";
  }
  return "string";
}

function mergeTypes(current, next) {
  if (!current || current === "null") {
    return next;
  }
  if (!next || next === "null" || current === next) {
    return current;
  }
  if ((current === "integer" && next === "decimal") || (current === "decimal" && next === "integer")) {
    return "decimal";
  }
  if ((current === "date" && next === "datetime") || (current === "datetime" && next === "date")) {
    return "datetime";
  }
  return "string";
}

function toSuggestedType(type, maxLength) {
  if (type === "boolean") return "boolean";
  if (type === "integer") return "bigint";
  if (type === "decimal") return "decimal(18,6)";
  if (type === "date") return "date";
  if (type === "datetime") return "datetime";
  if (type === "json") return maxLength > 2000 ? "text" : "varchar(2000)";
  if (maxLength <= 64) return `varchar(${Math.max(32, maxLength || 32)})`;
  if (maxLength <= 255) return `varchar(${Math.max(64, maxLength)})`;
  return "text";
}

function buildSchema(headers, rows = []) {
  return headers.map((header) => {
    let mergedType = "null";
    let maxLength = 0;
    let nullable = false;
    const samples = [];
    const counts = {
      boolean: 0,
      integer: 0,
      decimal: 0,
      date: 0,
      datetime: 0,
      json: 0,
      string: 0,
    };
    let nonNullCount = 0;

    rows.forEach((row) => {
      const value = row?.[header];
      const valueType = inferValueType(value);
      mergedType = mergeTypes(mergedType, valueType);
      if (valueType === "null") {
        nullable = true;
        return;
      }
      nonNullCount += 1;
      if (counts[valueType] !== undefined) {
        counts[valueType] += 1;
      } else {
        counts.string += 1;
      }
      const text = typeof value === "string" ? value : JSON.stringify(value);
      maxLength = Math.max(maxLength, String(text || "").length);
      if (samples.length < FIELD_SAMPLE_LIMIT) {
        samples.push(value);
      }
    });

    let resolvedType = mergedType === "null" ? "string" : mergedType;
    if (nonNullCount > 0) {
      const numericCount = counts.integer + counts.decimal;
      const dateTimeCount = counts.date + counts.datetime;
      if (counts.boolean / nonNullCount >= 0.7) {
        resolvedType = "boolean";
      } else if (numericCount / nonNullCount >= 0.6) {
        resolvedType = counts.decimal > 0 ? "decimal" : "integer";
      } else if (dateTimeCount / nonNullCount >= 0.6) {
        resolvedType = counts.datetime > 0 ? "datetime" : "date";
      } else if (counts.json / nonNullCount >= 0.6) {
        resolvedType = "json";
      } else if (counts.string > 0) {
        resolvedType = "string";
      }
    }

    return {
      sourceField: header,
      inferredType: resolvedType,
      suggestedType: toSuggestedType(resolvedType, maxLength),
      nullable: nullable || rows.length === 0,
      maxLength,
      sampleValues: samples,
    };
  });
}

function resolveJsonRoot(payload, rootPath = "") {
  if (!rootPath) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && typeof payload === "object") {
      const firstArray = Object.values(payload).find((item) => Array.isArray(item));
      if (Array.isArray(firstArray)) {
        return firstArray;
      }
    }
    return payload;
  }

  return String(rootPath)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), payload);
}

function getByPath(target, pathText = "") {
  return String(pathText)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => {
      if (Array.isArray(current)) {
        const index = Number(key);
        return Number.isInteger(index) ? current[index] : undefined;
      }
      if (current && typeof current === "object") {
        return current[key];
      }
      return undefined;
    }, target);
}

function findFirstObjectArray(target, depth = 0) {
  if (depth > 6 || target === null || target === undefined) {
    return null;
  }
  if (Array.isArray(target) && target.some((item) => item && typeof item === "object")) {
    return target;
  }
  if (target && typeof target === "object") {
    for (const value of Object.values(target)) {
      const result = findFirstObjectArray(value, depth + 1);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

function normalizeXmlNode(node) {
  if (node === null || node === undefined) {
    return null;
  }
  if (Array.isArray(node)) {
    return node.map((item) => normalizeXmlNode(item));
  }
  if (typeof node !== "object") {
    return node;
  }

  const result = {};
  Object.entries(node).forEach(([key, value]) => {
    if (key === "_text" || key === "_cdata") {
      result.value = value;
      return;
    }
    if (key === "_attributes" && value && typeof value === "object") {
      Object.entries(value).forEach(([attrKey, attrValue]) => {
        result[`@${attrKey}`] = attrValue;
      });
      return;
    }
    result[key] = normalizeXmlNode(value);
  });
  return result;
}

function normalizeXmlRow(row) {
  if (!row || typeof row !== "object") {
    return { value: normalizeScalarValue(row) };
  }

  return Object.entries(row).reduce((result, [key, value]) => {
    if (Array.isArray(value) || (value && typeof value === "object")) {
      if (value?.value !== undefined && Object.keys(value).length === 1) {
        result[key] = normalizeScalarValue(value.value);
      } else {
        result[key] = normalizeScalarValue(value);
      }
      return result;
    }
    result[key] = normalizeScalarValue(value);
    return result;
  }, {});
}

function parseDelimitedBuffer(buffer, options = {}) {
  const text = decodeBuffer(buffer, options.encoding || "utf8");
  const delimiter = options.delimiter || guessDelimiter(text.slice(0, 1024 * 1024));
  const quoteChar = options.quoteChar || "\"";

  if (options.previewOnly) {
    const firstDataRowNumber = Math.max(1, Number(options.firstDataRowNumber || 2));
    const sampleMatrix = [];
    const rowErrors = [];
    let totalRows = 0;
    forEachDelimitedLine(text, (line, index) => {
      const parsed = parseDelimitedLine(line, delimiter, quoteChar);
      if (parsed.inQuotes && rowErrors.length < 100) {
        rowErrors.push({
          rowNo: index + 1,
          errorType: "parse",
          errorMessage: "引号未闭合",
          rawData: line.slice(0, 1000),
        });
      }
      if (sampleMatrix.length < firstDataRowNumber - 1 + PREVIEW_SAMPLE_ROW_LIMIT) {
        sampleMatrix.push(parsed.values);
      }
      if (index >= firstDataRowNumber - 1 && parsed.values.some((value) => !isEmptyValue(value))) {
        totalRows += 1;
      }
    });
    const structured = matrixToStructuredRows(sampleMatrix, options);
    return {
      ...structured,
      totalRows,
      rowErrors,
      parseMeta: {
        delimiter,
        quoteChar,
        previewOnly: true,
      },
    };
  }

  const rawLines = text.split(/\r?\n/);
  const matrix = [];
  const rowErrors = [];

  rawLines.forEach((line, index) => {
    if (!line && index === rawLines.length - 1) {
      return;
    }
    const parsed = parseDelimitedLine(line, delimiter, quoteChar);
    if (parsed.inQuotes) {
      rowErrors.push({
        rowNo: index + 1,
        errorType: "parse",
        errorMessage: "引号未闭合",
        rawData: line,
      });
    }
    matrix.push(parsed.values);
  });

  const structured = matrixToStructuredRows(matrix, options);
  return {
    ...structured,
    totalRows: structured.rows.length,
    rowErrors,
    parseMeta: {
      delimiter,
      quoteChar,
    },
  };
}

function parseExcelBuffer(buffer, options = {}) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames || [];
  const selectedSheetName = options.sheetName && sheetNames.includes(options.sheetName)
    ? options.sheetName
    : sheetNames[0];
  const sheet = selectedSheetName ? workbook.Sheets[selectedSheetName] : null;
  const matrix = sheet ? xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) : [];
  const structured = matrixToStructuredRows(matrix, options);
  return {
    ...structured,
    rowErrors: [],
    parseMeta: {
      sheetNames,
      selectedSheetName,
    },
  };
}

function parseJsonBuffer(buffer, options = {}) {
  const text = decodeBuffer(buffer, options.encoding || "utf8");
  const parsed = JSON.parse(text);
  const root = resolveJsonRoot(parsed, options.jsonRootPath || "");
  const rows = Array.isArray(root) ? root : [root];
  const normalizedRows = rows.filter((item) => item && typeof item === "object").map((item) => {
    const next = {};
    Object.entries(item).forEach(([key, value]) => {
      next[key] = normalizeScalarValue(value);
    });
    return next;
  });
  const structured = objectRowsToStructuredRows(normalizedRows);
  return {
    ...structured,
    rowErrors: [],
    parseMeta: {
      jsonRootPath: options.jsonRootPath || "",
    },
  };
}

function parseXmlBuffer(buffer, options = {}) {
  const text = decodeBuffer(buffer, options.encoding || "utf8");
  const parsed = xmlJs.xml2js(text, { compact: true, trim: true });
  const normalized = normalizeXmlNode(parsed);
  const resolved = options.xmlRowPath ? getByPath(normalized, options.xmlRowPath) : findFirstObjectArray(normalized);
  const rows = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];
  const normalizedRows = rows.map((item) => normalizeXmlRow(item));
  const structured = objectRowsToStructuredRows(normalizedRows);
  return {
    ...structured,
    rowErrors: [],
    parseMeta: {
      xmlRowPath: options.xmlRowPath || "",
    },
  };
}

function parseFileBuffer(file, options = {}) {
  const fileType = String(options.fileType || detectFileType(file?.originalname || file?.fileName || "")).toLowerCase();

  if (["csv", "txt"].includes(fileType)) {
    return {
      fileType,
      ...parseDelimitedBuffer(file.buffer, options),
    };
  }

  if (["xls", "xlsx"].includes(fileType)) {
    return {
      fileType,
      ...parseExcelBuffer(file.buffer, options),
    };
  }

  if (fileType === "json") {
    return {
      fileType,
      ...parseJsonBuffer(file.buffer, options),
    };
  }

  if (fileType === "xml") {
    return {
      fileType,
      ...parseXmlBuffer(file.buffer, options),
    };
  }

  throw new Error(`暂不支持的文件类型：${fileType || "unknown"}`);
}

function buildPreviewResult(file, parseResult, options = {}) {
  const rows = parseResult.rows || [];
  const sampleRows = rows.slice(0, Number(options.previewLimit || DEFAULT_PREVIEW_LIMIT)).map((row) => {
    const next = { ...row };
    delete next.__rowNo;
    return next;
  });
  return {
    fileName: file.originalname || file.fileName,
    fileSize: Number(file.size || file.fileSize || 0),
    fileType: parseResult.fileType,
    availableSheets: parseResult.parseMeta?.sheetNames || [],
    selectedSheetName: parseResult.parseMeta?.selectedSheetName || options.sheetName || null,
    parseMeta: parseResult.parseMeta || {},
    totalRows: Number.isFinite(Number(parseResult.totalRows)) ? Number(parseResult.totalRows) : rows.length,
    sampleRows,
    rowErrors: parseResult.rowErrors || [],
    schema: buildSchema(parseResult.headers || [], rows),
  };
}

module.exports = {
  buildPreviewResult,
  buildSchema,
  detectFileType,
  parseFileBuffer,
};
