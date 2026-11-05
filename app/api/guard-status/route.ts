import { getApiGuardState } from "@/lib/api-guard/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const state = await getApiGuardState();
    return Response.json(
      { ok: true, state },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "[api-guard] Cannot read public status:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      {
        ok: false,
        code: "API_GUARD_STORAGE_UNAVAILABLE",
        message: "Không thể xác minh trạng thái bảo vệ.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
