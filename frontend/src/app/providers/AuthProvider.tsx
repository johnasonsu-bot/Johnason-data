import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchProfile, login as loginRequest, logout as logoutRequest } from "../../services/auth";
import { fetchLicenseStatus } from "../../services/license";
import { clearApplyDefaultProjectOnLogin, markApplyDefaultProjectOnLogin } from "../../services/projectContext";
import type { LicenseStatus, LoginPayload, UserProfile } from "../../types/api";
import { syncReadOnlyMode } from "../accessControl";

interface AuthContextValue {
  token: string | null;
  user: UserProfile | null;
  licenseStatus: LicenseStatus | null;
  licenseLoaded: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  logout: () => void;
  refreshLicenseStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "medata_enterprise_token";
const AUTH_TAB_ID_KEY = "medata_auth_tab_id";
const AUTH_TAB_REGISTRY_PREFIX = "medata_auth_tabs:";
const AUTH_TAB_STALE_MS = 2 * 60 * 1000;
function getAuthTabId() {
  const existing = sessionStorage.getItem(AUTH_TAB_ID_KEY);
  if (existing) return existing;

  const next = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem(AUTH_TAB_ID_KEY, next);
  return next;
}

function getSessionKey(token: string) {
  try {
    const payload = JSON.parse(window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.sessionId || token.slice(-24));
  } catch {
    return token.slice(-24);
  }
}

function getRegistryKey(token: string) {
  return `${AUTH_TAB_REGISTRY_PREFIX}${getSessionKey(token)}`;
}

function readAuthTabs(registryKey: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(registryKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function pruneAuthTabs(tabs: Record<string, number>) {
  const now = Date.now();
  return Object.fromEntries(Object.entries(tabs).filter(([, seenAt]) => now - Number(seenAt || 0) < AUTH_TAB_STALE_MS));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenseLoaded, setLicenseLoaded] = useState(false);
  const lastValidatedAtRef = useRef(0);

  async function refreshLicenseStatus(nextToken?: string) {
    const accessToken = nextToken || token;

    if (!accessToken) {
      setLicenseStatus(null);
      setLicenseLoaded(true);
      return;
    }

    try {
      const response = await fetchLicenseStatus(accessToken);
      setLicenseStatus(response.data);
    } catch (error: any) {
      if (error?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        syncReadOnlyMode(null);
        setToken(null);
        setUser(null);
        setLicenseStatus(null);
      } else if (error?.details?.licenseStatus || error?.details?.machineCode) {
        setLicenseStatus({
          isActivated: false,
          status: error.details?.licenseStatus || "tampered",
          message: error.message || "检测到授权篡改风险",
          serverTime: new Date().toISOString(),
          machineCode: error.details?.machineCode,
          licensedMachineCode: error.details?.licensedMachineCode
        });
      } else {
        setLicenseStatus(null);
      }
    } finally {
      setLicenseLoaded(true);
    }
  }

  async function validateSession(nextToken?: string, options?: { refreshLicense?: boolean }) {
    const accessToken = nextToken || token;
    if (!accessToken) {
      return;
    }

    try {
      const response = await fetchProfile(accessToken);
      setUser(response.data.user);
      syncReadOnlyMode(response.data.user);
      lastValidatedAtRef.current = Date.now();
      if (options?.refreshLicense) {
        await refreshLicenseStatus(accessToken);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      syncReadOnlyMode(null);
      setToken(null);
      setUser(null);
      setLicenseStatus(null);
      setLicenseLoaded(true);
    }
  }

  useEffect(() => {
    if (!token) {
      syncReadOnlyMode(null);
      setUser(null);
      setLicenseStatus(null);
      setLicenseLoaded(true);
      lastValidatedAtRef.current = 0;
      return;
    }

    setLicenseLoaded(false);
    void validateSession(token, { refreshLicense: true });
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tabId = getAuthTabId();
    const registryKey = getRegistryKey(token);

    const markCurrentTabActive = () => {
      const tabs = pruneAuthTabs(readAuthTabs(registryKey));
      tabs[tabId] = Date.now();
      localStorage.setItem(registryKey, JSON.stringify(tabs));
    };

    const releaseCurrentTab = () => {
      const tabs = pruneAuthTabs(readAuthTabs(registryKey));
      delete tabs[tabId];

      if (Object.keys(tabs).length > 0) {
        localStorage.setItem(registryKey, JSON.stringify(tabs));
        return;
      }

      localStorage.removeItem(registryKey);
    };

    const sendHeartbeat = () => {
      markCurrentTabActive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
        if (Date.now() - lastValidatedAtRef.current > 60_000) {
          void validateSession(token);
        }
      }
    };

    markCurrentTabActive();
    sendHeartbeat();
    const handlePageHide = () => {
      releaseCurrentTab();
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const heartbeat = window.setInterval(sendHeartbeat, 30000);

    return () => {
      releaseCurrentTab();
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(heartbeat);
    };
  }, [token]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) {
        return;
      }

      const nextToken = event.newValue || null;
      setToken((currentToken) => {
        if (currentToken === nextToken) {
          return currentToken;
        }

        if (!nextToken) {
          syncReadOnlyMode(null);
          setUser(null);
          setLicenseStatus(null);
          setLicenseLoaded(true);
          lastValidatedAtRef.current = 0;
          return null;
        }

        setUser(null);
        setLicenseLoaded(false);
        lastValidatedAtRef.current = 0;
        return nextToken;
      });
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  async function login(payload: LoginPayload) {
    const response = await loginRequest(payload);
    localStorage.setItem(TOKEN_KEY, response.data.token);
    markApplyDefaultProjectOnLogin();
    setToken(response.data.token);
    setUser(response.data.user);
    syncReadOnlyMode(response.data.user);
    lastValidatedAtRef.current = Date.now();
    setLicenseLoaded(false);
    await refreshLicenseStatus(response.data.token);
    return response.data.user;
  }

  function logout() {
    const currentToken = token;
    localStorage.removeItem(TOKEN_KEY);
    syncReadOnlyMode(null);
    clearApplyDefaultProjectOnLogin();
    setToken(null);
    setUser(null);
    setLicenseStatus(null);
    setLicenseLoaded(true);
    lastValidatedAtRef.current = 0;
    if (currentToken) {
      void logoutRequest(currentToken).catch(() => undefined);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        licenseStatus,
        licenseLoaded,
        isAuthenticated: Boolean(token),
        login,
        logout,
        refreshLicenseStatus: () => refreshLicenseStatus()
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
