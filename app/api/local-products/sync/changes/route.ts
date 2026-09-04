import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { ensureSyncBaseline } from "@/lib/sync";
import AppStateModel from "@/models/AppState";
import ProductModel from "@/models/Product";
import SyncChangeModel from "@/models/SyncChange";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncChangeRecord = {
  revision: number;
  entity: "product" | "state" | "catalog";
  entityId: string;
  operation: "upsert" | "trash" | "delete" | "reset";
};

const parseSince = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return 0;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const readAppState = async (): Promise<Record<string, unknown>> => {
  const state = await AppStateModel.findOne(
    { key: "main" },
    {
      _id: 0,
      key: 0,
      syncVersion: 0,
      updatedAt: 0,
    },
  ).lean();

  return state && typeof state === "object"
    ? (state as Record<string, unknown>)
    : {};
};

const isTrashedProduct = (product: unknown): boolean => {
  if (!product || typeof product !== "object") return false;

  const trashedAt = (product as Record<string, unknown>).trashedAt;
  return typeof trashedAt === "string" && trashedAt.trim().length > 0;
};

const readCatalogSnapshot = async () => {
  const [allProducts, state] = await Promise.all([
    ProductModel.find({}, { _id: 0 }).sort({ updatedAt: -1 }).lean(),
    readAppState(),
  ]);

  return {
    products: allProducts.filter((product) => !isTrashedProduct(product)),
    trashedProducts: allProducts.filter(isTrashedProduct),
    state,
  };
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const since = parseSince(url.searchParams.get("since"));

    if (since === null) {
      return apiError(new Error("since phải là số nguyên không âm"), 400);
    }

    await connectMongo();
    const version = await ensureSyncBaseline();

    if (since >= version) {
      return jsonNoStore({
        ok: true,
        version,
        mode: "delta",
        products: [],
        trashedProducts: [],
        deletedProductIds: [],
      });
    }

    const rawChanges = await SyncChangeModel.find(
      { revision: { $gt: since, $lte: version } },
      { _id: 0, revision: 1, entity: 1, entityId: 1, operation: 1 },
    )
      .sort({ revision: 1 })
      .lean();
    const changes = rawChanges as unknown as SyncChangeRecord[];

    const requiresSnapshot =
      since === 0 ||
      changes.length === 0 ||
      changes.some(
        (change) =>
          change.entity === "catalog" && change.operation === "reset",
      );

    if (requiresSnapshot) {
      const snapshot = await readCatalogSnapshot();
      return jsonNoStore({
        ok: true,
        version,
        mode: "snapshot",
        products: snapshot.products,
        trashedProducts: snapshot.trashedProducts,
        deletedProductIds: [],
        state: snapshot.state,
      });
    }

    const latestChanges = new Map<string, SyncChangeRecord>();

    changes.forEach((change) => {
      latestChanges.set(`${change.entity}:${change.entityId}`, change);
    });

    const productChanges = Array.from(latestChanges.values()).filter(
      (change) => change.entity === "product",
    );
    const productIdsToRead = productChanges
      .filter((change) => change.operation !== "delete")
      .map((change) => change.entityId);
    const productIdsToDelete = productChanges
      .filter((change) => change.operation === "delete")
      .map((change) => change.entityId);

    const [changedProducts, state] = await Promise.all([
      productIdsToRead.length > 0
        ? ProductModel.find({ id: { $in: productIdsToRead } }, { _id: 0 }).lean()
        : Promise.resolve([]),
      latestChanges.has("state:main") ? readAppState() : Promise.resolve(null),
    ]);

    return jsonNoStore({
      ok: true,
      version,
      mode: "delta",
      products: changedProducts.filter((product) => !isTrashedProduct(product)),
      trashedProducts: changedProducts.filter(isTrashedProduct),
      deletedProductIds: productIdsToDelete,
      ...(state ? { state } : {}),
    });
  } catch (error) {
    return apiError(error);
  }
}
