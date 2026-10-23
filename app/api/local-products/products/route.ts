import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { getProductPublicIds, validateProductInput } from "@/lib/products";
import { runWithSyncChange } from "@/lib/sync";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SourceDoneStatus {
  _id: string;
  id?: string;
  isDone: boolean;
  doneAt: string | null;
  updatedAt?: string;
}

function toIsoString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

export async function GET(request: Request) {
  try {
    await connectMongo();

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");
    const contentType = searchParams.get("contentType")?.trim();
    const filter = contentType ? { contentType } : {};

    if (view === "done-status") {
      // Read only fields used for live Done synchronization; do not transfer images.
      const rawProducts = await ProductModel.collection
        .find(filter, {
          projection: {
            _id: 1,
            id: 1,
            isDone: 1,
            doneAt: 1,
            updatedAt: 1,
          },
        })
        .sort({ updatedAt: -1 })
        .toArray();

      const products: SourceDoneStatus[] = rawProducts.map((item) => {
        const record = item as unknown as Record<string, unknown>;
        const rawId = record._id;
        const rawDoneAt = record.doneAt;

        return {
          _id:
            rawId && typeof rawId === "object" && "toString" in rawId
              ? String(rawId)
              : typeof rawId === "string"
                ? rawId
                : "",
          id: typeof record.id === "string" ? record.id : undefined,
          isDone: record.isDone === true,
          doneAt: toIsoString(rawDoneAt) ?? null,
          updatedAt: toIsoString(record.updatedAt),
        };
      });

      return jsonNoStore({
        ok: true,
        view: "done-status",
        count: products.length,
        products,
      });
    }

    const products = await ProductModel.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = products.map((product) => ({
      ...product,
      _id: product._id ? product._id.toString() : product._id,
    }));

    return jsonNoStore({ ok: true, products: formatted });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      products?: unknown;
    };

    if (!Array.isArray(body.products)) {
      return apiError(new Error("Dữ liệu import thiếu products"), 400);
    }

    const products = body.products.map(validateProductInput);
    const ids = products.map((product) => product.id);

    if (new Set(ids).size !== ids.length) {
      return apiError(new Error("Dữ liệu import có ID sản phẩm bị trùng"), 400);
    }

    await connectMongo();

    const { value: previousProducts, syncVersion } = await runWithSyncChange(
      { entity: "catalog", entityId: "main", operation: "reset" },
      async (session) => {
        const previous = await ProductModel.find(
          {},
          { _id: 0, images: 1, internalImages: 1 },
        )
          .session(session)
          .lean();

        if (products.length > 0) {
          await ProductModel.bulkWrite(
            products.map((product) => ({
              replaceOne: {
                filter: { id: product.id },
                replacement: product,
                upsert: true,
              },
            })),
            { ordered: true, session },
          );
          await ProductModel.deleteMany({ id: { $nin: ids } }, { session });
        } else {
          await ProductModel.deleteMany({}, { session });
        }

        return previous;
      },
    );

    const currentPublicIds = new Set(products.flatMap(getProductPublicIds));
    const obsoletePublicIds = previousProducts
      .flatMap(getProductPublicIds)
      .filter((publicId) => !currentPublicIds.has(publicId));
    const cleanup = await destroyCloudinaryImages(obsoletePublicIds);

    return jsonNoStore({
      ok: true,
      count: products.length,
      cleanup,
      syncVersion,
    });
  } catch (error) {
    return apiError(error, 400);
  }
}
