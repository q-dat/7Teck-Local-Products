import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { getProductPublicIds, validateProductInput } from "@/lib/products";
import { runWithSyncChange } from "@/lib/sync";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectMongo();
    const products = await ProductModel.find({}, { _id: 0 })
      .sort({ updatedAt: -1 })
      .lean();
    return jsonNoStore({ ok: true, products });
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
