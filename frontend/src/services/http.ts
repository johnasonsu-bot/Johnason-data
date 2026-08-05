import { getSelectedProjectId } from "./projectContext";
import { isReadOnlyAllowedRequest, isReadOnlyModeActive } from "../app/accessControl";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type ParsedHttpBody = {
  data: any;
  isJson: boolean;
  rawText: string;
};

function getHeaders(token?: string, body?: BodyInit | null): HeadersInit {
  const headers: HeadersInit = {};

  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const projectId = getSelectedProjectId();
  if (projectId) {
    headers["X-Project-Id"] = String(projectId);
  }

  return headers;
}

function normalizeApiPath(path: string) {
  if (path === "/data-lab-sources" || path.startsWith("/data-lab-sources/") || path.startsWith("/data-lab-sources?")) {
    return path.replace("/data-lab-sources", "/data-modeling-sources");
  }
  if (path === "/data-lab" || path.startsWith("/data-lab/")) {
    return path.replace("/data-lab", "/data-modeling");
  }
  return path;
}

async function parseResponseBody(response: Response): Promise<ParsedHttpBody> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  const contentType = response.headers.get("content-type") || "";
  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (!trimmed) {
    return {
      data: {},
      isJson: true,
      rawText
    };
  }

  if (!looksLikeJson) {
    return {
      data: { raw: rawText },
      isJson: false,
      rawText
    };
  }

  try {
    return {
      data: JSON.parse(rawText),
      isJson: true,
      rawText
    };
  } catch {
    return {
      data: { raw: rawText },
      isJson: false,
      rawText
    };
  }
}

export async function http<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const normalizedPath = normalizeApiPath(path);
  const method = String(init?.method || "GET").toUpperCase();
  if (isReadOnlyModeActive() && !isReadOnlyAllowedRequest(method, normalizedPath)) {
    throw new HttpError("只读用户仅允许查看，不能执行新建、修改、删除、运行或发布操作", 403, {
      code: "READ_ONLY_FORBIDDEN",
      path: normalizedPath,
    });
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    cache: init?.cache ?? (method === "GET" ? "default" : "no-store"),
    headers: {
      ...getHeaders(token, init?.body || null),
      ...(init?.headers || {})
    }
  });

  const { data, isJson, rawText } = await parseResponseBody(response);

  if (!response.ok) {
    const details = (data as any).details;
    const fieldErrors = details?.fieldErrors;
    const fieldMessage = fieldErrors && typeof fieldErrors === "object"
      ? Object.entries(fieldErrors)
        .flatMap(([field, messages]) => Array.isArray(messages) ? messages.map((item) => `${field}: ${item}`) : [])
        .join("; ")
      : "";
    const message = fieldMessage
      ? `${(data as any).message || "请求失败"}：${fieldMessage}`
      : ((data as any).message || "请求失败");
    throw new HttpError(message, response.status, details);
  }

  if (!isJson) {
    const snippet = rawText.trim().slice(0, 120).replace(/\s+/g, " ");
    throw new HttpError(
      `接口返回了非 JSON 响应，可能是页面 HTML 或网关错误: ${snippet || "empty response"}`,
      response.status || 500,
      { path: normalizedPath, rawText }
    );
  }

  return data as T;
}
