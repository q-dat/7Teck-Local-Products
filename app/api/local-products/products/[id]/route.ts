import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import { getProductPublicIds, validateProductInput } from "@/lib/products";
import { runWithSyncChange } from "@/lib/sync";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const product = validateProductInput(await request.json());
    if (product.id !== id) return apiError(new Error("ID sản phẩm không khớp"), 400);

    const activeProduct = { ...product, trashedAt: "" };
    const { value: previous, syncVersion } = await runWithSyncChange(
      { entity: "product", entityId: id, operation: "upsert" },
      async (session) => {
        const previousProduct = await ProductModel.findOne(
          { id },
          { _id: 0 },
        )
          .session(session)
          .lean();
        const previousRecord = previousProduct as unknown as Record<string, unknown> | null;

        if (
          previousRecord &&
          typeof previousRecord.trashedAt === "string" &&
          previousRecord.trashedAt
        ) {
          throw new Error("Hãy khôi phục sản phẩm khỏi Thùng rác trước khi chỉnh sửa");
        }

        await ProductModel.replaceOne({ id }, activeProduct, {
          upsert: true,
          runValidators: true,
          session,
        });

        return previousProduct;
      },
    );

    const nextPublicIds = new Set(getProductPublicIds(activeProduct));
    const removedPublicIds = getProductPublicIds(previous).filter(
      (publicId) => !nextPublicIds.has(publicId),
    );
    const cleanup = await destroyCloudinaryImages(removedPublicIds);

    return jsonNoStore({ ok: true, product: activeProduct, cleanup, syncVersion });
  } catch (error) {
    return apiError(error, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { value: product, syncVersion } = await runWithSyncChange(
      { entity: "product", entityId: id, operation: "delete" },
      async (session) => {
        const deletedProduct = await ProductModel.findOneAndDelete(
          { id, trashedAt: { $exists: true, $ne: "" } },
          { projection: { _id: 0 }, session },
        ).lean();

        if (deletedProduct) return deletedProduct;

        const activeProductExists = await ProductModel.exists({ id }).session(
          session,
        );
        throw new Error(
          activeProductExists
            ? "Phải chuyển sản phẩm vào Thùng rác trước khi xóa vĩnh viễn"
            : "Không tìm thấy sản phẩm",
        );
      },
    );

    const cleanup = await destroyCloudinaryImages(getProductPublicIds(product));
    return jsonNoStore({ ok: true, cleanup, syncVersion });
  } catch (error) {
    return apiError(error);
  }
}
