const pdfParse = require("pdf-parse");

const MAX_PDF_TEXT_LENGTH = 20000;

function cleanText(text, maxLength = MAX_PDF_TEXT_LENGTH) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizePdfDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const matched = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!matched) {
    return null;
  }
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = matched;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function extractPdfTextFromBuffer(buffer) {
  const parsed = await pdfParse(buffer);
  return {
    text: cleanText(parsed.text),
    pageCount: Number(parsed.numpages || 0),
    info: parsed.info || {},
    metadata: parsed.metadata || null,
    publishedAt: normalizePdfDate(parsed.info?.ModDate || parsed.info?.CreationDate || null),
  };
}

module.exports = {
  extractPdfTextFromBuffer,
  normalizePdfDate,
};
