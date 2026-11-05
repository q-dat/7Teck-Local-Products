"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeApiGuardEvents } from "@/lib/api-guard/client";

type ApiGuardState = {
  enabled: boolean;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

type ConnectionState = "checking" | "online" | "offline";
type GuardCommand = "ENABLE" | "DISABLE";

const ADMIN_ENDPOINT = "/api/admin/api-guard";
const ADMIN_SESSION_ENDPOINT = `${ADMIN_ENDPOINT}/session`;
const STATUS_ENDPOINT = "/api/guard-status";
const ADMIN_TOKEN_STORAGE_KEY = "api_guard_admin_token";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parseApiGuardState = (value: unknown): ApiGuardState | null => {
  if (!isRecord(value) || !isRecord(value.state)) return null;

  const state = value.state;
  if (
    typeof state.enabled !== "boolean" ||
    typeof state.revision !== "number" ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0
  ) {
    return null;
  }

  return {
    enabled: state.enabled,
    revision: state.revision,
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : null,
    updatedBy: typeof state.updatedBy === "string" ? state.updatedBy : null,
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

const getResponseMessage = (payload: unknown, fallback: string): string => {
  if (!isRecord(payload) || typeof payload.message !== "string") {
    return fallback;
  }

  return payload.message;
};

export default function ApiGuardAdminPage() {
  const [guardState, setGuardState] = useState<ApiGuardState | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("checking");
  const [adminToken, setAdminToken] = useState("");
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [isRestoringToken, setIsRestoringToken] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const applyGuardState = useCallback((nextState: ApiGuardState): void => {
    setGuardState((currentState) => {
      if (currentState && nextState.revision < currentState.revision) {
        return currentState;
      }
      return nextState;
    });
  }, []);

  const clearSavedToken = useCallback((): void => {
    setAdminToken("");
    setIsAdminAuthenticated(false);

    try {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // Keep the page usable when browser storage is unavailable.
    }
  }, []);

  const authenticateWithToken = useCallback(
    async (token: string): Promise<boolean> => {
      const normalizedToken = token.trim();
      if (!normalizedToken) return false;

      try {
        const sessionResponse = await fetch(ADMIN_SESSION_ENDPOINT, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${normalizedToken}`,
          },
        });
        const sessionPayload = await readJson(sessionResponse);

        if (sessionResponse.status === 401) {
          clearSavedToken();
          setNotice("Token không hợp lệ hoặc đã bị thu hồi.");
          return false;
        }

        if (!sessionResponse.ok) {
          throw new Error(
            getResponseMessage(
              sessionPayload,
              `Không thể xác thực (HTTP ${sessionResponse.status}).`,
            ),
          );
        }

        const statusResponse = await fetch(ADMIN_ENDPOINT, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const statusPayload = await readJson(statusResponse);

        if (statusResponse.status === 401) {
          clearSavedToken();
          setNotice("Token không còn hợp lệ. Vui lòng nhập token mới.");
          return false;
        }

        if (!statusResponse.ok) {
          throw new Error(
            getResponseMessage(
              statusPayload,
              `Không thể đọc trạng thái (HTTP ${statusResponse.status}).`,
            ),
          );
        }

        const nextState = parseApiGuardState(statusPayload);
        if (!nextState) {
          throw new Error("Dữ liệu trạng thái không hợp lệ.");
        }

        applyGuardState(nextState);
        setIsAdminAuthenticated(true);
        setNotice("");
        return true;
      } catch (error: unknown) {
        setIsAdminAuthenticated(false);
        setNotice(
          error instanceof Error ? error.message : "Không thể xác thực quản trị.",
        );
        return false;
      }
    },
    [applyGuardState, clearSavedToken],
  );

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(STATUS_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          getResponseMessage(
            payload,
            `Không thể đọc trạng thái (HTTP ${response.status}).`,
          ),
        );
      }

      const nextState = parseApiGuardState(payload);
      if (!nextState) throw new Error("Dữ liệu trạng thái không hợp lệ.");
      applyGuardState(nextState);
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : "Không thể kết nối máy chủ.",
      );
    }
  }, [applyGuardState]);

  useEffect(() => {
    let isActive = true;

    const restoreToken = async (): Promise<void> => {
      try {
        const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);

        if (savedToken) {
          setAdminToken(savedToken);
          setIsRestoringToken(true);
          await authenticateWithToken(savedToken);
        }
      } catch {
        if (isActive) setNotice("Không thể đọc token đã lưu trên thiết bị.");
      } finally {
        if (isActive) {
          setIsRestoringToken(false);
          setIsTokenReady(true);
        }
      }
    };

    void restoreToken();
    void refreshStatus();

    return () => {
      isActive = false;
    };
  }, [authenticateWithToken, refreshStatus]);

  useEffect(() => {
    return subscribeApiGuardEvents((event) => {
      if (event.type === "connection") {
        setConnectionState(event.connected ? "online" : "offline");
        return;
      }

      applyGuardState(event.state);
      setConnectionState("online");
    });
  }, [applyGuardState]);

  const handleTokenChange = (value: string): void => {
    setAdminToken(value);
    setIsAdminAuthenticated(false);
    setNotice("");

    try {
      if (value.trim()) {
        window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      }
    } catch {
      setNotice("Không thể lưu token trên thiết bị.");
    }
  };

  const sendCommand = async (
    command: GuardCommand,
    token: string,
  ): Promise<void> => {
    const execute = async (): Promise<Response> =>
      fetch(ADMIN_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

    let response = await execute();

    if (response.status === 401) {
      setIsAdminAuthenticated(false);
      const renewed = await authenticateWithToken(token);
      if (!renewed) return;
      response = await execute();
    }

    const payload = await readJson(response);
    if (response.status === 401) {
      clearSavedToken();
      throw new Error("Token không hợp lệ hoặc đã hết hiệu lực.");
    }

    if (!response.ok) {
      throw new Error(
        getResponseMessage(
          payload,
          `Không thể gửi lệnh (HTTP ${response.status}).`,
        ),
      );
    }

    const nextState = parseApiGuardState(payload);
    if (!nextState) throw new Error("Máy chủ trả về trạng thái không hợp lệ.");

    applyGuardState(nextState);
    setIsAdminAuthenticated(true);
    setNotice("");
  };

  const handlePowerToggle = async (): Promise<void> => {
    const token = adminToken.trim();
    if (!token || !guardState || connectionState !== "online") return;

    const command: GuardCommand = guardState.enabled ? "DISABLE" : "ENABLE";

    setIsSubmitting(true);
    setNotice("");

    try {
      if (!isAdminAuthenticated) {
        const authenticated = await authenticateWithToken(token);
        if (!authenticated) return;
      }

      await sendCommand(command, token);
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : "Không thể điều khiển API Guard.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEnabled = guardState?.enabled === true;
  const canToggle =
    isTokenReady &&
    !isRestoringToken &&
    !isSubmitting &&
    Boolean(adminToken.trim()) &&
    connectionState === "online" &&
    guardState !== null;

  const statusLabel =
    connectionState === "checking"
      ? "ĐANG KẾT NỐI"
      : connectionState === "offline"
        ? "MẤT KẾT NỐI"
        : guardState === null
          ? "ĐANG ĐỒNG BỘ"
          : isEnabled
            ? "ĐANG BẢO VỆ"
            : "ĐANG TẮT";

  const buttonColor = isEnabled
    ? "border-emerald-300/70 bg-emerald-400/15 text-emerald-200 shadow-[0_0_70px_rgba(52,211,153,0.18)] hover:bg-emerald-400/20"
    : "border-sky-300/60 bg-sky-400/10 text-sky-100 shadow-[0_0_70px_rgba(56,189,248,0.12)] hover:bg-sky-400/20";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#070b12] px-4 py-8 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0d1420] px-5 py-8 shadow-2xl shadow-black/30 xl:px-8 xl:py-10">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-slate-500">
            API GUARD
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${connectionState === "online"
                  ? "bg-emerald-400"
                  : connectionState === "offline"
                    ? "bg-rose-400"
                    : "animate-pulse bg-amber-300"
                }`}
            />
            <span className="text-[10px] font-semibold tracking-[0.16em] text-slate-400">
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="my-9 flex justify-center">
          <button
            type="button"
            onClick={() => void handlePowerToggle()}
            disabled={!canToggle}
            aria-label={isEnabled ? "Tắt API Guard" : "Bật API Guard"}
            aria-pressed={isEnabled}
            className={`group relative flex size-48 items-center justify-center rounded-full border-[3px] transition duration-300 ease-out hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 xl:size-56 ${buttonColor}`}
          >
            <span className="absolute inset-2 rounded-full border border-current/20" />
            <span className="absolute inset-5 rounded-full border border-current/10" />
            <span className="relative flex flex-col items-center gap-3">
              {isSubmitting || isRestoringToken ? (
                <span className="h-11 w-11 animate-spin rounded-full border-[3px] border-current/20 border-t-current" />
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-12 w-12"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2.75v8.5" />
                  <path d="M7.05 5.9a8.25 8.25 0 1 0 9.9 0" />
                </svg>
              )}
              <span className="text-[11px] font-black tracking-[0.2em]">
                {isSubmitting || isRestoringToken
                  ? "WAIT"
                  : isEnabled
                    ? "TẮT"
                    : "BẬT"}
              </span>
            </span>
          </button>
        </div>

        <label className="block">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Admin token
          </span>
          <input
            type="password"
            value={adminToken}
            onChange={(event) => handleTokenChange(event.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder="Nhập token"
            aria-label="API Guard Admin Token"
            className="h-12 w-full rounded-xl border border-white/10 bg-[#080e18] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/60 focus:ring-2 focus:ring-sky-300/10"
          />
        </label>

        <p className="mt-3 min-h-5 text-center text-[11px] leading-5 text-rose-300" role="status" aria-live="polite">
          {notice}
        </p>

        <p className="mt-1 text-center text-[10px] text-slate-600">
          {isRestoringToken
            ? "Đang khôi phục phiên..."
            : isAdminAuthenticated
              ? "Đã sẵn sàng"
              : "Token được lưu trên thiết bị này"}
        </p>
      </section>
    </main>
  );
}
