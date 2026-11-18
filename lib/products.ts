import type { ProductInput, ProductRecord } from "@/types/local-products";
import { connectMongo } from "@/lib/mongodb";
import AppStateModel from "@/models/AppState";
import ProductModel from "@/models/Product";
import { isMongoObjectIdString } from "@/lib/mongo-id";

export { isMongoObjectIdString } from "@/lib/mongo-id";

type ImageLike = { publicId?: unknown };

export const getProductPublicIds = (product: unknown): string[] => {
  if (!product || typeof product !== "object") return [];
  const record = product as { images?: unknown; internalImages?: unknown; posters?: unknown };

  const imagePublicIds = [record.images, record.internalImages].flatMap((value) => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((image) => {
      const publicId = (image as ImageLike | null)?.publicId;
      return typeof publicId === "string" && publicId.trim() ? [publicId.trim()] : [];
    });
  });

  const posterPublicIds = Array.isArray(record.posters)
    ? record.posters.flatMap((poster) => {
        const publicId = (poster as ImageLike | null)?.publicId;
        return typeof publicId === "string" && publicId.trim() ? [publicId.trim()] : [];
      })
    : [];

  return [...imagePublicIds, ...posterPublicIds];
};

export const validateProductInput = (value: unknown): ProductInput => {
  if (!value || typeof value !== "object") throw new Error("Sản phẩm không hợp lệ");
  const product = value as Partial<ProductRecord> & Record<string, unknown>;

  if (typeof product.name !== "string" || !product.name.trim()) {
    throw new Error("Sản phẩm thiếu tên");
  }

  const posters = Array.isArray(product.posters) ? product.posters : [];

  for (const image of [...(product.images ?? []), ...(product.internalImages ?? [])]) {
    if (!image || typeof image !== "object") throw new Error("Ảnh không hợp lệ");
    if (!image.publicId || !image.dataUrl) {
      throw new Error("Ảnh chưa được upload hoàn tất lên Cloudinary");
    }
    if (image.dataUrl.startsWith("data:")) {
      throw new Error("MongoDB không nhận ảnh Base64; hãy upload ảnh lên Cloudinary trước");
    }
  }

  for (const poster of posters) {
    if (!poster || typeof poster !== "object") throw new Error("Poster không hợp lệ");
    if (
      typeof poster.id !== "string" ||
      typeof poster.fileName !== "string" ||
      typeof poster.posterName !== "string" ||
      typeof poster.url !== "string" ||
      typeof poster.publicId !== "string" ||
      !poster.publicId.trim() ||
      !poster.url.startsWith("https://")
    ) {
      throw new Error("Poster chưa được upload hoàn tất lên Cloudinary");
    }
  }

  const fields = { ...product };
  delete fields._id;
  delete fields.id;
  delete fields.legacyId;

  return {
    ...(fields as ProductInput),
    categoryGroup: typeof product.categoryGroup === "string" ? product.categoryGroup : "",
    posters,
  };
};

export const serializeProductRecord = (value: unknown): ProductRecord => {
  if (!value || typeof value !== "object") {
    throw new Error("Sản phẩm MongoDB không hợp lệ");
  }

  const source = value as Record<string, unknown>;
  const mongoId = source._id;
  if (!mongoId || typeof mongoId !== "string" && typeof mongoId !== "object") {
    throw new Error("Sản phẩm MongoDB thiếu _id");
  }

  const fields = { ...source };
  delete fields._id;
  delete fields.id;
  return {
    ...fields,
    _id: String(mongoId),
  } as ProductRecord;
};

let legacyProductIndexesChecked = false;

export const ensureLegacyProductIdMigration = async (): Promise<Record<string, string>> => {
  await connectMongo();

  const legacyProducts = await ProductModel.collection
    .find({ id: { $exists: true } })
    .project<{ _id: unknown; id: unknown }>({ _id: 1, id: 1 })
    .toArray();
  const appState = (await AppStateModel.findOne(
    { key: "main" },
    { legacyProductIdMap: 1, _id: 0 },
  ).lean()) as { legacyProductIdMap?: unknown } | null;
  const storedMap = appState?.legacyProductIdMap;
  const legacyIdMap: Record<string, string> = {};
  if (storedMap && typeof storedMap === "object" && !Array.isArray(storedMap)) {
    Object.entries(storedMap as Record<string, unknown>).forEach(([legacyId, mongoId]) => {
      if (legacyId.trim() && isMongoObjectIdString(mongoId)) {
        legacyIdMap[legacyId] = mongoId;
      }
    });
  }

  legacyProducts.forEach((product) => {
    const legacyId = typeof product.id === "string" ? product.id.trim() : "";
    const mongoId = product._id ? String(product._id) : "";
    if (legacyId && isMongoObjectIdString(mongoId)) {
      legacyIdMap[legacyId] = mongoId;
    }
  });

  if (legacyProducts.length > 0) {
    await AppStateModel.updateOne(
      { key: "main" },
      {
        $set: { legacyProductIdMap: legacyIdMap },
        $setOnInsert: { key: "main" },
      },
      { upsert: true, runValidators: true },
    );
  }

  if (!legacyProductIndexesChecked || legacyProducts.length > 0) {
    const productIndexes = await ProductModel.collection.indexes().catch((error: unknown) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 26
      ) {
        return [];
      }
      throw error;
    });
    await Promise.all(
      productIndexes
        .filter((index) => index.name !== "_id_" && "id" in index.key)
        .map((index) =>
          ProductModel.collection.dropIndex(index.name!).catch((error: unknown) => {
            if (
              error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === 27
            ) {
              return;
            }
            throw error;
          }),
        ),
    );
    legacyProductIndexesChecked = true;
  }

  if (legacyProducts.length > 0) {
    await ProductModel.collection.updateMany(
      { id: { $exists: true } },
      { $unset: { id: "" } },
    );
  }

  return legacyIdMap;
};
