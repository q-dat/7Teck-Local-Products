import { destroyCloudinaryImages, isManagedCloudinaryPublicId } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import ProductModel from "@/models/Product";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { publicIds?: unknown };
    const publicIds = Array.isArray(body.publicIds)
      ? Array.from(new Set(body.publicIds.filter((value): value is string => typeof value === "string")))
      : [];

    if (publicIds.length === 0 || publicIds.some((id) => !isManagedCloudinaryPublicId(id))) {
      return apiError(new Error("Danh sách public_id không hợp lệ"), 400);
    }

    await connectMongo();
    const attached = await ProductModel.exists({
      $or: [
        { "images.publicId": { $in: publicIds } },
        { "internalImages.publicId": { $in: publicIds } },
      ],
    });

    if (attached) {
      return apiError(new Error("Không xóa trực tiếp ảnh đang thuộc một sản phẩm"), 409);
    }

    const cleanup = await destroyCloudinaryImages(publicIds);
    return jsonNoStore(
      { ok: cleanup.failed.length === 0, cleanup },
      { status: cleanup.failed.length === 0 ? 200 : 502 },
    );
  } catch (error) {
    return apiError(error, 400);
  }
}