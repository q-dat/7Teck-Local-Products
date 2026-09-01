import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { getProductPublicIds } from "@/lib/products";
import AppStateModel from "@/models/AppState";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    await connectMongo();
    const products = await ProductModel.find({}, { _id: 0, images: 1, internalImages: 1 }).lean();
    await Promise.all([ProductModel.deleteMany({}), AppStateModel.deleteMany({ key: "main" })]);
    const cleanup = await destroyCloudinaryImages(products.flatMap(getProductPublicIds));
    return jsonNoStore({ ok: true, cleanup });
  } catch (error) {
    return apiError(error);
  }
}
