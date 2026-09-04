import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import { getProductPublicIds } from "@/lib/products";
import { runWithSyncChange } from "@/lib/sync";
import AppStateModel from "@/models/AppState";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const { value: products, syncVersion } = await runWithSyncChange(
      { entity: "catalog", entityId: "main", operation: "reset" },
      async (session) => {
        const currentProducts = await ProductModel.find(
          {},
          { _id: 0, images: 1, internalImages: 1 },
        )
          .session(session)
          .lean();

        await Promise.all([
          ProductModel.deleteMany({}, { session }),
          AppStateModel.updateOne(
            { key: "main" },
            {
              $set: {
                settings: null,
                scheduleConfig: null,
                scheduleAssignments: {},
                postedRecords: [],
                updatedAt: new Date(),
              },
              $setOnInsert: { key: "main" },
            },
            { upsert: true, runValidators: true, session },
          ),
        ]);

        return currentProducts;
      },
    );
    const cleanup = await destroyCloudinaryImages(products.flatMap(getProductPublicIds));
    return jsonNoStore({ ok: true, cleanup, syncVersion });
  } catch (error) {
    return apiError(error);
  }
}
