import type { ProductRecord } from "@/types/local-products";

type ImageLike = { publicId?: unknown };

export const getProductPublicIds = (product: unknown): string[] => {
  if (!product || typeof product !== "object") return [];
  const record = product as { images?: unknown; internalImages?: unknown };

  return [record.images, record.internalImages].flatMap((value) => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((image) => {
      const publicId = (image as ImageLike | null)?.publicId;
      return typeof publicId === "string" && publicId.trim() ? [publicId.trim()] : [];
    });
  });
};

export const validateProductInput = (value: unknown): ProductRecord => {
  if (!value || typeof value !== "object") throw new Error("Sản phẩm không hợp lệ");
  const product = value as ProductRecord;

  if (typeof product.id !== "string" || !product.id.trim()) {
    throw new Error("Sản phẩm thiếu ID");
  }
  if (typeof product.name !== "string" || !product.name.trim()) {
    throw new Error("Sản phẩm thiếu tên");
  }

  for (const image of [...(product.images ?? []), ...(product.internalImages ?? [])]) {
    if (!image || typeof image !== "object") throw new Error("Ảnh không hợp lệ");
    if (!image.publicId || !image.dataUrl) {
      throw new Error("Ảnh chưa được upload hoàn tất lên Cloudinary");
    }
    if (image.dataUrl.startsWith("data:")) {
      throw new Error("MongoDB không nhận ảnh Base64; hãy upload ảnh lên Cloudinary trước");
    }
  }

  return product;
};
