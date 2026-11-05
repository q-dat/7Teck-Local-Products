import { getApiGuardState } from "@/lib/api-guard/store";

export class ApiGuardActiveError extends Error {
  readonly code = "API_GUARD_ACTIVE";
  readonly statusCode = 423;

  constructor() {
    super("API Guard đang bật. Thao tác truy cập dữ liệu đã bị khóa.");
    this.name = "ApiGuardActiveError";
  }
}

/**
 * Call before database access in Server Actions, cron jobs, background jobs,
 * or server-side code paths that do not pass through the API middleware.
 */
export async function assertApiGuardDisabled(): Promise<void> {
  const state = await getApiGuardState();
  if (state.enabled) throw new ApiGuardActiveError();
}
