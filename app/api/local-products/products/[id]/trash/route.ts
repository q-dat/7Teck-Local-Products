import { apiError, jsonNoStore } from "@/lib/http";
import { runWithSyncChange } from "@/lib/sync";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const activeProductFilter = (id: string) => ({
  id,
  $or: [{ trashedAt: "" }, { trashedAt: { $exists: false } }],
});

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { value: product, syncVersion } = await runWithSyncChange(
      { entity: "product", entityId: id, operation: "trash" },
      async (session) => {
        const nextProduct = await ProductModel.findOneAndUpdate(
          activeProductFilter(id),
          { $set: { trashedAt: new Date().toISOString() } },
          { new: true, projection: { _id: 0 }, runValidators: true, session },
        ).lean();

        if (!nextProduct) {
          throw new Error("Không tìm thấy sản phẩm đang hoạt động");
        }

        return nextProduct;
      },
    );

    return jsonNoStore({ ok: true, product, syncVersion });
  } catch (error) {
    return apiError(error, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { value: product, syncVersion } = await runWithSyncChange(
      { entity: "product", entityId: id, operation: "upsert" },
      async (session) => {
        const nextProduct = await ProductModel.findOneAndUpdate(
          { id, trashedAt: { $exists: true, $ne: "" } },
          {
            $set: {
              trashedAt: "",
              updatedAt: new Date().toISOString(),
            },
          },
          { new: true, projection: { _id: 0 }, runValidators: true, session },
        ).lean();

        if (!nextProduct) {
          throw new Error("Không tìm thấy sản phẩm trong Thùng rác");
        }

        return nextProduct;
      },
    );

    return jsonNoStore({ ok: true, product, syncVersion });
  } catch (error) {
    return apiError(error, 400);
  }
}
