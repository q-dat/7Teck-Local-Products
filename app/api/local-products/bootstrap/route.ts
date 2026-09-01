import { jsonNoStore, apiError } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import AppStateModel from "@/models/AppState";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectMongo();
    const [products, rawState] = await Promise.all([
      ProductModel.find({}, { _id: 0 }).sort({ updatedAt: -1 }).lean(),
      AppStateModel.findOne({ key: "main" }, { _id: 0, key: 0, updatedAt: 0 }).lean(),
    ]);
    const state = rawState as
      | {
          settings?: unknown;
          scheduleConfig?: unknown;
          scheduleAssignments?: unknown;
          postedRecords?: unknown;
        }
      | null;

    return jsonNoStore({
      products,
      settings: state?.settings ?? null,
      scheduleConfig: state?.scheduleConfig ?? null,
      scheduleAssignments: state?.scheduleAssignments ?? {},
      postedRecords: state?.postedRecords ?? [],
    });
  } catch (error) {
    return apiError(error);
  }
}
