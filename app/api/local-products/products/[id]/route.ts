import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { getProductPublicIds, validateProductInput } from "@/lib/products";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const product = validateProductInput(await request.json());
    if (product.id !== id) return apiError(new Error("ID sản phẩm không khớp"), 400);

    await connectMongo();
    const previous = await ProductModel.findOne({ id }, { _id: 0 }).lean();
    await ProductModel.replaceOne({ id }, product, { upsert: true, runValidators: true });

    const nextPublicIds = new Set(getProductPublicIds(product));
    const removedPublicIds = getProductPublicIds(previous).filter(
      (publicId) => !nextPublicIds.has(publicId),
    );
    const cleanup = await destroyCloudinaryImages(removedPublicIds);

    return jsonNoStore({ ok: true, product, cleanup });
  } catch (error) {
    return apiError(error, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await connectMongo();
    const product = await ProductModel.findOneAndDelete({ id }, { projection: { _id: 0 } }).lean();
    if (!product) return apiError(new Error("Không tìm thấy sản phẩm"), 404);

    const cleanup = await destroyCloudinaryImages(getProductPublicIds(product));
    return jsonNoStore({ ok: true, cleanup });
  } catch (error) {
    return apiError(error);
  }
}
