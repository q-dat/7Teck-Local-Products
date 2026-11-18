import { apiError, jsonNoStore } from "@/lib/http";
import { ensureLegacyProductIdMigration, serializeProductRecord } from "@/lib/products";
import AppStateModel from "@/models/AppState";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const legacyIdMap = await ensureLegacyProductIdMigration();
    const [rawProducts, rawState] = await Promise.all([
      ProductModel.find({}).sort({ updatedAt: -1 }).lean(),
      AppStateModel.findOne(
        { key: "main" },
        { _id: 0, key: 0, updatedAt: 0, syncVersion: 0, legacyProductIdMap: 0 },
      ).lean(),
    ]);
    const state = rawState as {
      settings?: unknown;
    } | null;

    return jsonNoStore({
      products: rawProducts.map(serializeProductRecord),
      legacyIdMap,
      settings: state?.settings ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}
