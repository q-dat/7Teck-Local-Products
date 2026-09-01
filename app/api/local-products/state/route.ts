import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import AppStateModel from "@/models/AppState";

export const runtime = "nodejs";

const ALLOWED_STATE_KEYS = new Set([
  "settings",
  "scheduleConfig",
  "scheduleAssignments",
  "postedRecords",
]);

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = { updatedAt: new Date() };

    Object.entries(body).forEach(([key, value]) => {
      if (ALLOWED_STATE_KEYS.has(key)) update[key] = value;
    });

    if (Object.keys(update).length === 1) {
      return apiError(new Error("Không có trạng thái hợp lệ để lưu"), 400);
    }

    await connectMongo();
    await AppStateModel.updateOne(
      { key: "main" },
      { $set: update, $setOnInsert: { key: "main" } },
      { upsert: true, runValidators: true },
    );

    return jsonNoStore({ ok: true });
  } catch (error) {
    return apiError(error, 400);
  }
}
