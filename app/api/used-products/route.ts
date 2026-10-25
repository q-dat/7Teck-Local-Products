import { Types } from "mongoose";
import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { slugifyText } from "@/lib/slug";
import UsedProductModel, { type IUsedProductDoc } from "@/models/UsedProduct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProductSyncInput {
  name?: string;
  sourceProductId?: string | null;
  description?: string;
  price?: number;
  priceText?: string;
  category?: string;
  categorySlug?: string | null;
  parentCategory?: string | null;
  parentCategorySlug?: string | null;
  images?: unknown[];
  status?: string;
  pin?: string;
  isDone?: boolean;
  doneAt?: string | null;
}

interface ProductIdentity {
  _id: Types.ObjectId;
  slug: string;
}

interface NormalizedProductInput {
  name: string;
  sourceProductId: string | null;
  description: string;
  price: number;
  priceText: string;
  category: string;
  categorySlug: string | null;
  parentCategory: string | null;
  parentCategorySlug: string | null;
  images: unknown[];
  status: string;
  pin: string;
  isDone: boolean;
  doneAt: string | null;
  sourceNameSnapshot: string;
  sourceDescriptionSnapshot: string;
}

type ProductBulkUpdates = Partial<
  Pick<
    ProductSyncInput,
    | "description"
    | "price"
    | "priceText"
    | "category"
    | "categorySlug"
    | "parentCategory"
    | "parentCategorySlug"
    | "images"
    | "status"
    | "pin"
    | "isDone"
    | "doneAt"
  >
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isProductInput = (value: unknown): value is ProductSyncInput =>
  isRecord(value);

const isDuplicateKeyError = (
  error: unknown,
): error is {
  code: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
} => isRecord(error) && error.code === 11000;

const duplicateKeyName = (error: unknown): string | undefined => {
  if (!isDuplicateKeyError(error)) return undefined;
  if (error.keyPattern?.slug || error.keyValue?.slug !== undefined)
    return "slug";
  if (
    error.keyPattern?.sourceProductId ||
    error.keyValue?.sourceProductId !== undefined
  )
    return "sourceProductId";
  return undefined;
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeImages = (imagesInput: unknown): unknown[] => {
  if (!Array.isArray(imagesInput)) return [];

  return imagesInput
    .map((image): string => {
      if (typeof image === "string") return image.trim();
      if (image && typeof image === "object") {
        const record = image as {
          dataUrl?: unknown;
          url?: unknown;
          src?: unknown;
        };
        const url = record.dataUrl || record.url || record.src || "";
        return typeof url === "string" ? url.trim() : "";
      }
      return "";
    })
    .filter((image) => image.length > 0);
};

async function generateUniqueProductIdentity(
  name: string,
  reservedSlugs: Set<string>,
  forceSuffix = false,
): Promise<ProductIdentity> {
  const baseSlug = slugifyText(name);
  if (!baseSlug) {
    throw new Error(`Không thể tạo slug từ tên sản phẩm "${name}"`);
  }

  if (!forceSuffix && !reservedSlugs.has(baseSlug)) {
    reservedSlugs.add(baseSlug);
    const baseExists = await UsedProductModel.exists({ slug: baseSlug });
    if (!baseExists) {
      return { _id: new Types.ObjectId(), slug: baseSlug };
    }
    reservedSlugs.delete(baseSlug);
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const _id = new Types.ObjectId();
    const slug = `${baseSlug}-${_id.toHexString().slice(-10)}`;
    if (reservedSlugs.has(slug)) continue;

    reservedSlugs.add(slug);
    const exists = await UsedProductModel.exists({ slug });
    if (!exists) return { _id, slug };
    reservedSlugs.delete(slug);
  }

  throw new Error(`Không thể tạo slug duy nhất cho sản phẩm "${name}"`);
}

async function createProductWithUniqueSlug(
  input: NormalizedProductInput,
  reservedSlugs: Set<string>,
): Promise<IUsedProductDoc> {
  const name = input.name.trim();
  let lastSlug = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const identity = await generateUniqueProductIdentity(
      name,
      reservedSlugs,
      attempt > 0,
    );
    lastSlug = identity.slug;

    try {
      return await UsedProductModel.create({ ...input, ...identity });
    } catch (error: unknown) {
      reservedSlugs.delete(identity.slug);
      if (duplicateKeyName(error) === "slug") continue;
      throw error;
    }
  }

  throw new Error(`Slug "${lastSlug}" vẫn bị trùng sau nhiều lần thử`);
}

function normalizeProductInput(item: ProductSyncInput): NormalizedProductInput {
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const sourceProductId =
    typeof item.sourceProductId === "string" && item.sourceProductId.trim()
      ? item.sourceProductId.trim()
      : null;

  const isDone = typeof item.isDone === "boolean" ? item.isDone : false;
  const providedDoneAt =
    typeof item.doneAt === "string" && item.doneAt.trim() ? item.doneAt : null;
  const category = typeof item.category === "string" ? item.category.trim() : "";
  const categorySlug =
    item.categorySlug !== undefined
      ? typeof item.categorySlug === "string" && item.categorySlug.trim()
        ? slugifyText(item.categorySlug) || null
        : null
      : category
        ? slugifyText(category) || null
        : null;
  const parentCategory =
    typeof item.parentCategory === "string" && item.parentCategory.trim()
      ? item.parentCategory.trim()
      : null;
  const parentCategorySlug =
    item.parentCategorySlug !== undefined
      ? typeof item.parentCategorySlug === "string" && item.parentCategorySlug.trim()
        ? slugifyText(item.parentCategorySlug) || null
        : null
      : parentCategory
        ? slugifyText(parentCategory) || null
        : null;

  return {
    name,
    sourceProductId,
    description: typeof item.description === "string" ? item.description : "",
    price:
      typeof item.price === "number" &&
      Number.isFinite(item.price) &&
      item.price >= 0
        ? item.price
        : 0,
    priceText: typeof item.priceText === "string" ? item.priceText : "",
    category,
    categorySlug,
    parentCategory,
    parentCategorySlug,
    images: normalizeImages(item.images),
    status:
      typeof item.status === "string" && item.status.trim()
        ? item.status.trim()
        : "active",
    pin: typeof item.pin === "string" ? item.pin : "",
    isDone,
    doneAt: isDone ? providedDoneAt || new Date().toISOString() : null,
    sourceNameSnapshot: name,
    sourceDescriptionSnapshot:
      typeof item.description === "string" ? item.description : "",
  };
}

function validObjectIds(values: unknown): string[] | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const ids = values.filter(
    (value): value is string =>
      typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value),
  );
  return ids.length === values.length ? [...new Set(ids)] : null;
}

function validateBulkUpdates(value: unknown): ProductBulkUpdates | null {
  if (!isRecord(value)) return null;

  const allowed = new Set([
    "description",
    "price",
    "priceText",
    "category",
    "categorySlug",
    "parentCategory",
    "parentCategorySlug",
    "images",
    "status",
    "pin",
    "isDone",
    "doneAt",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;

  const updates: ProductBulkUpdates = {};
  if ("description" in value) {
    if (typeof value.description !== "string") return null;
    updates.description = value.description;
  }
  if ("price" in value) {
    if (
      typeof value.price !== "number" ||
      !Number.isFinite(value.price) ||
      value.price < 0
    )
      return null;
    updates.price = value.price;
  }
  if ("priceText" in value) {
    if (typeof value.priceText !== "string") return null;
    updates.priceText = value.priceText;
  }
  if ("category" in value) {
    if (typeof value.category !== "string") return null;
    updates.category = value.category;
    if (!("categorySlug" in value)) {
      updates.categorySlug = value.category.trim()
        ? slugifyText(value.category) || null
        : null;
    }
  }
  if ("categorySlug" in value) {
    if (value.categorySlug !== null && typeof value.categorySlug !== "string") return null;
    updates.categorySlug = typeof value.categorySlug === "string"
      ? slugifyText(value.categorySlug.trim()) || null
      : null;
  }
  if ("parentCategory" in value) {
    if (
      value.parentCategory !== null &&
      typeof value.parentCategory !== "string"
    )
      return null;
    updates.parentCategory = value.parentCategory;
    if (!("parentCategorySlug" in value)) {
      updates.parentCategorySlug =
        typeof value.parentCategory === "string" && value.parentCategory.trim()
          ? slugifyText(value.parentCategory) || null
          : null;
    }
  }
  if ("parentCategorySlug" in value) {
    if (
      value.parentCategorySlug !== null &&
      typeof value.parentCategorySlug !== "string"
    )
      return null;
    updates.parentCategorySlug = typeof value.parentCategorySlug === "string"
      ? slugifyText(value.parentCategorySlug.trim()) || null
      : null;
  }
  if ("images" in value) {
    if (!Array.isArray(value.images)) return null;
    updates.images = normalizeImages(value.images);
  }
  if ("status" in value) {
    if (typeof value.status !== "string" || !value.status.trim()) return null;
    updates.status = value.status.trim();
  }
  if ("pin" in value) {
    if (typeof value.pin !== "string") return null;
    updates.pin = value.pin;
  }
  if ("isDone" in value) {
    if (typeof value.isDone !== "boolean") return null;
    updates.isDone = value.isDone;
  }
  if ("doneAt" in value) {
    if (value.doneAt !== null && typeof value.doneAt !== "string") return null;
    updates.doneAt = value.doneAt;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

export async function GET(request: Request) {
  try {
    await connectMongo();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug")?.trim();

    if (slug) {
      const product = await UsedProductModel.findOne({ slug }).lean();
      if (!product) return apiError(new Error("Không tìm thấy sản phẩm"), 404);
      return jsonNoStore({
        ok: true,
        product: { ...product, _id: product._id.toString() },
      });
    }

    const view = searchParams.get("view");
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category")?.trim();
    const categorySlug = searchParams.get("categorySlug")?.trim();
    const parentCategory = searchParams.get("parentCategory")?.trim();
    const parentCategorySlug = searchParams.get("parentCategorySlug")?.trim();
    const status = searchParams.get("status")?.trim();
    const isDoneParam = searchParams.get("isDone");
    const sourceProductId = searchParams.get("sourceProductId")?.trim();

    if (
      isDoneParam !== null &&
      isDoneParam !== "true" &&
      isDoneParam !== "false"
    ) {
      return apiError(
        new Error("isDone chỉ nhận giá trị true hoặc false"),
        400,
      );
    }

    const query: Record<string, unknown> = {};
    const conditions: Record<string, unknown>[] = [];

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      conditions.push({
        $or: [{ name: regex }, { slug: regex }, { sourceProductId: regex }],
      });
    }
    if (category) conditions.push({ category });
    if (categorySlug) conditions.push({ categorySlug });
    if (parentCategory) conditions.push({ parentCategory });
    if (parentCategorySlug) conditions.push({ parentCategorySlug });
    if (status) conditions.push({ status });
    if (isDoneParam === "true") {
      conditions.push({ isDone: true });
    } else if (isDoneParam === "false") {
      // Include legacy records without isDone until the migration has run.
      conditions.push({
        $or: [{ isDone: false }, { isDone: { $exists: false } }],
      });
    }
    if (sourceProductId) conditions.push({ sourceProductId });
    if (conditions.length === 1) Object.assign(query, conditions[0]);
    else if (conditions.length > 1) query.$and = conditions;

    if (view === "sync") {
      const [products, count] = await Promise.all([
        UsedProductModel.find(query)
          .select("_id name slug sourceProductId __v updatedAt isDone doneAt")
          .sort({ createdAt: -1 })
          .lean(),
        UsedProductModel.countDocuments(query),
      ]);

      return jsonNoStore({
        ok: true,
        view: "sync",
        count,
        products: products.map((product) => ({
          ...product,
          _id: product._id.toString(),
          sourceProductId: product.sourceProductId || null,
        })),
      });
    }

    const pageRequested = searchParams.has("page") || searchParams.has("limit");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "25", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(100, Math.max(1, parsedLimit))
      : 25;

    let productsQuery = UsedProductModel.find(query).sort({
      createdAt: -1,
      _id: -1,
    });

    if (pageRequested) {
      productsQuery = productsQuery.skip((page - 1) * limit).limit(limit);
    }

    const [products, count] = await Promise.all([
      productsQuery.lean(),
      pageRequested
        ? UsedProductModel.countDocuments(query)
        : Promise.resolve<number | null>(null),
    ]);

    return jsonNoStore({
      ok: true,
      count: count ?? products.length,
      page: pageRequested ? page : null,
      limit: pageRequested ? limit : null,
      products: products.map((product) => ({
        ...product,
        _id: product._id.toString(),
        sourceProductId: product.sourceProductId || null,
      })),
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectMongo();
    const body: unknown = await request.json();
    const rawList: unknown[] | null = Array.isArray(body)
      ? body
      : isRecord(body) && Array.isArray(body.products)
        ? body.products
        : null;

    if (rawList !== null) {
      const validItems = rawList.filter(isProductInput);
      if (validItems.length === 0) {
        return apiError(new Error("Danh sách sản phẩm trống"), 400);
      }

      const incomingSourceIds = validItems
        .map((item) =>
          typeof item.sourceProductId === "string"
            ? item.sourceProductId.trim()
            : "",
        )
        .filter(Boolean);
      const existingDocs =
        incomingSourceIds.length > 0
          ? await UsedProductModel.find({
              sourceProductId: { $in: incomingSourceIds },
            })
              .select("sourceProductId")
              .lean()
          : [];
      const existingSourceIds = new Set(
        existingDocs
          .map((doc) => doc.sourceProductId)
          .filter((id): id is string => typeof id === "string" && Boolean(id)),
      );

      const reservedSlugs = new Set<string>();
      const inserted: Array<Record<string, unknown>> = [];
      const skipped: Array<{
        sourceProductId: string;
        name?: string;
        reason?: string;
      }> = [];
      let invalidCount = 0;

      for (const item of validItems) {
        const normalized = normalizeProductInput(item);
        const name = typeof normalized.name === "string" ? normalized.name : "";
        if (!name) {
          invalidCount += 1;
          continue;
        }

        const sourceId =
          typeof normalized.sourceProductId === "string"
            ? normalized.sourceProductId
            : null;

        if (sourceId && existingSourceIds.has(sourceId)) {
          skipped.push({
            sourceProductId: sourceId,
            name,
            reason: "already-exists",
          });
          continue;
        }

        try {
          const product = await createProductWithUniqueSlug(
            normalized,
            reservedSlugs,
          );
          inserted.push({ ...product.toObject(), _id: product._id.toString() });
          if (sourceId) existingSourceIds.add(sourceId);
        } catch (error: unknown) {
          if (duplicateKeyName(error) === "sourceProductId" && sourceId) {
            existingSourceIds.add(sourceId);
            skipped.push({
              sourceProductId: sourceId,
              name,
              reason: "source-conflict",
            });
            continue;
          }
          throw error;
        }
      }

      return jsonNoStore({
        ok: true,
        insertedCount: inserted.length,
        skippedCount: skipped.length,
        invalidCount,
        inserted,
        skipped,
      });
    }

    if (!isProductInput(body)) {
      return apiError(new Error("Dữ liệu sản phẩm không hợp lệ"), 400);
    }

    const normalized = normalizeProductInput(body);
    if (typeof normalized.name !== "string" || !normalized.name) {
      return apiError(new Error("Tên sản phẩm không được để trống"), 400);
    }

    const sourceId =
      typeof normalized.sourceProductId === "string"
        ? normalized.sourceProductId
        : null;

    if (sourceId) {
      const existing = await UsedProductModel.findOne({
        sourceProductId: sourceId,
      })
        .select("_id")
        .lean();
      if (existing) {
        return apiError(
          new Error(`sourceProductId "${sourceId}" đã tồn tại`),
          409,
        );
      }
    }

    const product = await createProductWithUniqueSlug(
      normalized,
      new Set<string>(),
    );
    return jsonNoStore({
      ok: true,
      message: "Tạo sản phẩm thành công",
      product: { ...product.toObject(), _id: product._id.toString() },
    });
  } catch (error: unknown) {
    if (duplicateKeyName(error) === "sourceProductId") {
      return apiError(
        new Error("sourceProductId đã được liên kết với sản phẩm khác"),
        409,
      );
    }
    if (duplicateKeyName(error) === "slug") {
      return apiError(
        new Error("Không thể tạo slug duy nhất sau nhiều lần thử"),
        409,
      );
    }
    return apiError(error, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    await connectMongo();
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return apiError(
        new Error("Dữ liệu cập nhật hàng loạt không hợp lệ"),
        400,
      );
    }

    const ids = validObjectIds(body.ids);
    const updates = validateBulkUpdates(body.updates);
    if (!ids || !updates) {
      return apiError(
        new Error(
          "Cần truyền ids hợp lệ và ít nhất một trường cập nhật được hỗ trợ",
        ),
        400,
      );
    }

    if ("isDone" in updates && !("doneAt" in updates)) {
      updates.doneAt = updates.isDone ? new Date().toISOString() : null;
    }

    const hasVersions = Object.prototype.hasOwnProperty.call(body, "versions");
    let result: { matchedCount: number; modifiedCount: number };

    if (hasVersions) {
      if (!isRecord(body.versions)) {
        return apiError(
          new Error("Danh sách phiên bản sản phẩm không hợp lệ"),
          400,
        );
      }

      const versions: Record<string, number> = {};
      for (const id of ids) {
        const version = body.versions[id];
        if (
          typeof version !== "number" ||
          !Number.isSafeInteger(version) ||
          version < 0
        ) {
          return apiError(
            new Error(`Thiếu phiên bản __v hợp lệ cho sản phẩm ${id}`),
            400,
          );
        }
        versions[id] = version;
      }

      const writeResult = await UsedProductModel.bulkWrite(
        ids.map((id) => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(id), __v: versions[id] },
            update: { $set: updates, $inc: { __v: 1 } },
          },
        })),
        { ordered: false },
      );

      result = {
        matchedCount: writeResult.matchedCount,
        modifiedCount: writeResult.modifiedCount,
      };
    } else {
      const writeResult = await UsedProductModel.updateMany(
        { _id: { $in: ids } },
        { $set: updates, $inc: { __v: 1 } },
        { runValidators: true },
      );

      result = {
        matchedCount: writeResult.matchedCount,
        modifiedCount: writeResult.modifiedCount,
      };
    }

    const conflictCount = Math.max(0, ids.length - result.matchedCount);

    return jsonNoStore({
      ok: true,
      message:
        conflictCount > 0
          ? "Cập nhật hoàn tất; một số sản phẩm đã thay đổi hoặc bị xóa trước khi cập nhật"
          : "Cập nhật hàng loạt hoàn tất",
      requestedCount: ids.length,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      conflictCount,
    });
  } catch (error: unknown) {
    if (
      duplicateKeyName(error) === "sourceProductId" ||
      duplicateKeyName(error) === "slug"
    ) {
      return apiError(
        new Error("Dữ liệu cập nhật gây trùng khóa duy nhất"),
        409,
      );
    }
    return apiError(error, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    await connectMongo();
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return apiError(new Error("Dữ liệu xóa hàng loạt không hợp lệ"), 400);
    }

    const ids = validObjectIds(body.ids);
    if (!ids) {
      return apiError(
        new Error("Danh sách ids không hợp lệ hoặc đang trống"),
        400,
      );
    }

    const hasVersions = Object.prototype.hasOwnProperty.call(body, "versions");
    if (hasVersions) {
      if (!isRecord(body.versions)) {
        return apiError(
          new Error("Danh sách phiên bản sản phẩm không hợp lệ"),
          400,
        );
      }

      const versions: Record<string, number> = {};
      for (const id of ids) {
        const version = body.versions[id];
        if (
          typeof version !== "number" ||
          !Number.isSafeInteger(version) ||
          version < 0
        ) {
          return apiError(
            new Error(`Thiếu phiên bản __v hợp lệ cho sản phẩm ${id}`),
            400,
          );
        }
        versions[id] = version;
      }

      const result = await UsedProductModel.bulkWrite(
        ids.map((id) => ({
          deleteOne: {
            filter: { _id: new Types.ObjectId(id), __v: versions[id] },
          },
        })),
        { ordered: false },
      );
      const deletedCount = result.deletedCount;
      const conflictCount = Math.max(0, ids.length - deletedCount);

      return jsonNoStore({
        ok: true,
        message:
          conflictCount > 0
            ? "Đã xóa các sản phẩm không thay đổi; một số sản phẩm đã được cập nhật hoặc xóa ở nơi khác"
            : "Xóa hàng loạt hoàn tất",
        requestedCount: ids.length,
        deletedCount,
        conflictCount,
      });
    }

    const result = await UsedProductModel.deleteMany({ _id: { $in: ids } });
    return jsonNoStore({
      ok: true,
      message: "Xóa hàng loạt hoàn tất",
      requestedCount: ids.length,
      deletedCount: result.deletedCount || 0,
      conflictCount: Math.max(0, ids.length - (result.deletedCount || 0)),
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
