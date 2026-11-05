import {
  isApiGuardAdminAuthorized,
} from "@/lib/api-guard/admin-auth";
import {
  getApiGuardState,
  setApiGuardState,
} from "@/lib/api-guard/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function unauthorizedResponse(): Response {
  const tokenConfigured = Boolean(process.env.API_GUARD_ADMIN_TOKEN?.trim());
  return jsonResponse(
    {
      ok: false,
      code: tokenConfigured ? "UNAUTHORIZED" : "API_GUARD_NOT_CONFIGURED",
      message: tokenConfigured
        ? "Không có quyền quản lý API Guard."
        : "Thiếu API_GUARD_ADMIN_TOKEN trên server.",
    },
    tokenConfigured ? 401 : 503,
  );
}

export async function GET(request: Request): Promise<Response> {
  if (!isApiGuardAdminAuthorized(request)) return unauthorizedResponse();

  try {
    const state = await getApiGuardState();
    return jsonResponse({ ok: true, state });
  } catch (error: unknown) {
    console.error(
      "[api-guard] Cannot read MongoDB state:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse(
      {
        ok: false,
        code: "API_GUARD_STORAGE_UNAVAILABLE",
        message: "Không thể đọc trạng thái bảo vệ từ MongoDB.",
      },
      503,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isApiGuardAdminAuthorized(request)) return unauthorizedResponse();

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(
        { ok: false, code: "INVALID_BODY", message: "Request body không hợp lệ." },
        400,
      );
    }

    const command = (body as Record<string, unknown>).command;
    if (command !== "ENABLE" && command !== "DISABLE") {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_COMMAND",
          message: 'command chỉ nhận "ENABLE" hoặc "DISABLE".',
        },
        400,
      );
    }

    const state = await setApiGuardState(command === "ENABLE", "admin-page");

    return jsonResponse({
      ok: true,
      message: state.enabled
        ? "Đã bật chế độ bảo vệ API trên toàn hệ thống."
        : "Đã tắt chế độ bảo vệ API trên toàn hệ thống.",
      state,
    });
  } catch (error: unknown) {
    console.error(
      "[api-guard] Cannot update MongoDB state:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse(
      {
        ok: false,
        code: "API_GUARD_STORAGE_UNAVAILABLE",
        message: "Không thể cập nhật trạng thái bảo vệ trong MongoDB.",
      },
      503,
    );
  }
}
