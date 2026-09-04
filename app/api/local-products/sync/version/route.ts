import { apiError, jsonNoStore } from "@/lib/http";
import { ensureSyncBaseline } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const version = await ensureSyncBaseline();
    return jsonNoStore({ ok: true, version });
  } catch (error) {
    return apiError(error);
  }
}
