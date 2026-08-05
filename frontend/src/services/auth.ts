import { http } from "./http";
import type { ApiEnvelope, LoginPayload, LoginResponse, UserProfile } from "../types/api";

const inflightProfileRequests = new Map<string, Promise<ApiEnvelope<{ user: UserProfile }>>>();

export function login(payload: LoginPayload) {
  return http<ApiEnvelope<LoginResponse>>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchProfile(token: string) {
  const inflight = inflightProfileRequests.get(token);
  if (inflight) {
    return inflight;
  }

  const request = http<ApiEnvelope<{ user: UserProfile }>>("/auth/profile", undefined, token)
    .finally(() => {
      inflightProfileRequests.delete(token);
    });
  inflightProfileRequests.set(token, request);
  return request;
}

export function logout(token: string) {
  return http<ApiEnvelope<{ success: boolean }>>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  }, token);
}

export function logoutOnPageUnload(token: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  const url = `${apiBaseUrl}/auth/logout-beacon`;
  const body = JSON.stringify({ token });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) {
      return;
    }
  }

  void fetch(url, {
    method: "POST",
    body,
    keepalive: true,
    headers: {
      "Content-Type": "application/json"
    }
  }).catch(() => undefined);
}
