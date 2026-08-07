export type PreviewRendererKey = "html" | "markdown" | "code" | "json" | "table" | "pdf" | "image" | "audio" | "video" | "unsupported";

export interface PreviewViewerLike {
  kind?: string | null;
  language?: string | null;
}

const HTML_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

export function resolvePreviewRenderer(viewer?: PreviewViewerLike | null): PreviewRendererKey {
  const kind = String(viewer?.kind || "").toLowerCase();
  if (kind === "office") return "pdf";
  if (["html", "markdown", "code", "json", "table", "pdf", "image", "audio", "video"].includes(kind)) {
    return kind as PreviewRendererKey;
  }
  return "unsupported";
}

export function buildSandboxedHtml(value: string): string {
  const source = String(value || "");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${HTML_CSP}">`;
  if (/<head(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<head(?:\s[^>]*)?>/i, (match) => `${match}${meta}`);
  }
  if (/<html(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<html(?:\s[^>]*)?>/i, (match) => `${match}<head>${meta}</head>`);
  }
  return `<!doctype html><html><head>${meta}</head><body>${source}</body></html>`;
}

export function formatJsonContent(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function parseCsvRows(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsvContent(value: string): { columns: string[]; rows: Array<Record<string, string>> } {
  const parsedRows = parseCsvRows(String(value || ""));
  if (!parsedRows.length) return { columns: [], rows: [] };
  const columns = parsedRows[0].map((column, index) => column.trim() || `column_${index + 1}`);
  const rows = parsedRows.slice(1)
    .filter((values) => values.some((field) => field !== ""))
    .map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index] || ""])));
  return { columns, rows };
}
