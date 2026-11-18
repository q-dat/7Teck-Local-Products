import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import {
  ensureLegacyProductIdMigration,
  getProductPublicIds,
  isMongoObjectIdString,
  serializeProductRecord,
  validateProductInput,
} from "@/lib/products";
import { runWithSyncChange } from "@/lib/sync";
import ProductModel from "@/models/Product";
import { Types } from "mongoose";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const getMongoId = (value: string): Types.ObjectId | null =>
  isMongoObjectIdString(value) ? new Types.ObjectId(value) : null;

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const mongoId = getMongoId(id);
    if (!mongoId) return apiError(new Error("_id sản phẩm không hợp lệ"), 400);
    await ensureLegacyProductIdMigration();
    const body = await request.json();
    const bodyId = body && typeof body === "object"
      ? (body as Record<string, unknown>)._id
      : null;
    if (
      !isMongoObjectIdString(bodyId) ||
      bodyId.toLowerCase() !== mongoId.toHexString()
    ) {
      return apiError(new Error("_id sản phẩm không khớp"), 400);
    }
    const product = validateProductInput(body);

    const { value: previous, syncVersion } = await runWithSyncChange(
      { entity: "product", entityId: mongoId.toHexString(), operation: "upsert" },
      async (session) => {
        const previousProduct = await ProductModel.findById(mongoId)
          .session(session)
          .lean();

        if (!previousProduct) throw new Error("Không tìm thấy sản phẩm");

        await ProductModel.replaceOne({ _id: mongoId }, { ...product, _id: mongoId }, {
          runValidators: true,
          session,
        });

        return previousProduct;
      },
    );

    const nextPublicIds = new Set(getProductPublicIds(product));
    const removedPublicIds = getProductPublicIds(previous).filter(
      (publicId) => !nextPublicIds.has(publicId),
    );
    const cleanup = await destroyCloudinaryImages(removedPublicIds);

    return jsonNoStore({
      ok: true,
      product: serializeProductRecord({ ...product, _id: mongoId }),
      cleanup,
      syncVersion,
    });
  } catch (error) {
    return apiError(error, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const mongoId = getMongoId(id);
    if (!mongoId) return apiError(new Error("_id sản phẩm không hợp lệ"), 400);
    await ensureLegacyProductIdMigration();
    const { value: product, syncVersion } = await runWithSyncChange(
      { entity: "product", entityId: mongoId.toHexString(), operation: "delete" },
      async (session) => {
        const deletedProduct = await ProductModel.findByIdAndDelete(
          mongoId,
          { session },
        ).lean();

        if (deletedProduct) return deletedProduct;
        throw new Error("Không tìm thấy sản phẩm");
      },
    );

    const cleanup = await destroyCloudinaryImages(getProductPublicIds(product));
    return jsonNoStore({ ok: true, cleanup, syncVersion });
  } catch (error) {
    return apiError(error);
  }
}
