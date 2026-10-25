import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { slugifyText } from "@/lib/slug";
import UsedProductModel from "@/models/UsedProduct";
import mongoose from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsPromise = {
  params: Promise<{ slug: string }>;
};

interface ProductUpdateInput {
  __v?: number;
  name?: string;
  slug?: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeImages = (images: unknown[]): unknown[] =>
  images
    .map((image): string => {
      if (typeof image === "string") return image.trim();
      if (image && typeof image === "object") {
        const record = image as { dataUrl?: unknown; url?: unknown; src?: unknown };
        const value = record.dataUrl || record.url || record.src || "";
        return typeof value === "string" ? value.trim() : "";
      }
      return "";
    })
    .filter((image) => image.length > 0);

const isDuplicateKeyError = (error: unknown): boolean =>
  isRecord(error) && error.code === 11000;

const isVersionError = (error: unknown): boolean =>
  error instanceof mongoose.Error.VersionError;

async function getLookupKey(
  request: Request,
  params: ParamsPromise["params"],
): Promise<string> {
  const { slug: routeSlug } = await params;
  return new URL(request.url).searchParams.get("slug")?.trim() || routeSlug.trim();
}

async function findProductBySlugOrId(slugOrId: string) {
  const product = await UsedProductModel.findOne({ slug: slugOrId });
  if (product) return product;

  if (/^[0-9a-fA-F]{24}$/.test(slugOrId) && mongoose.Types.ObjectId.isValid(slugOrId)) {
    return UsedProductModel.findById(slugOrId);
  }

  return null;
}

export async function GET(request: Request, { params }: ParamsPromise) {
  try {
    await connectMongo();
    const lookupKey = await getLookupKey(request, params);
    if (!lookupKey) return apiError(new Error("Vui lòng cung cấp slug sản phẩm"), 400);

    const product = await findProductBySlugOrId(lookupKey);
    if (!product) return apiError(new Error("Không tìm thấy sản phẩm"), 404);

    return jsonNoStore({
      ok: true,
      product: { ...product.toObject(), _id: product._id.toString() },
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: ParamsPromise) {
  try {
    await connectMongo();
    const lookupKey = await getLookupKey(request, params);
    if (!lookupKey) return apiError(new Error("Vui lòng cung cấp slug sản phẩm"), 400);

    const product = await findProductBySlugOrId(lookupKey);
    if (!product) return apiError(new Error("Không tìm thấy sản phẩm để cập nhật"), 404);

    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) {
      return apiError(new Error("Dữ liệu cập nhật không hợp lệ"), 400);
    }
    const body = rawBody as ProductUpdateInput;

    if (typeof body.__v === "number" && body.__v !== (product.__v ?? 0)) {
      return apiError(
        new Error("Sản phẩm đã được cập nhật bởi một thao tác khác. Hãy tải lại dữ liệu trước khi lưu."),
        409,
      );
    }

    const requestedName = body.name === undefined
      ? undefined
      : typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : null;

    if (body.name !== undefined && requestedName === null) {
      return apiError(new Error("Tên sản phẩm không được để trống"), 400);
    }

    if (body.slug !== undefined && (typeof body.slug !== "string" || !body.slug.trim())) {
      return apiError(new Error("Slug không hợp lệ"), 400);
    }

    const nameChanged =
      requestedName !== undefined &&
      requestedName !== null &&
      requestedName !== product.name;

    const shouldDeriveSlugFromName =
      nameChanged &&
      (body.slug === undefined || body.slug.trim() === product.slug);

    const slugInput = shouldDeriveSlugFromName
      ? requestedName
      : typeof body.slug === "string"
        ? body.slug.trim()
        : undefined;

    if (slugInput !== undefined) {
      const formattedSlug = slugifyText(slugInput);
      if (!formattedSlug) return apiError(new Error("Không thể tạo slug từ dữ liệu cung cấp"), 400);

      if (formattedSlug !== product.slug) {
        const collision = await UsedProductModel.findOne({
          slug: formattedSlug,
          _id: { $ne: product._id },
        }).select("_id").lean();

        if (collision && shouldDeriveSlugFromName) {
          const idSuffix = product._id.toString().slice(-10);
          const slugWithId = `${formattedSlug}-${idSuffix}`;
          const suffixCollision = await UsedProductModel.findOne({
            slug: slugWithId,
            _id: { $ne: product._id },
          }).select("_id").lean();

          if (suffixCollision) {
            return apiError(new Error(`Slug "${slugWithId}" đã tồn tại; không thể tạo slug theo ID của sản phẩm`), 409);
          }
          product.slug = slugWithId;
        } else if (collision) {
          return apiError(new Error(`Slug "${formattedSlug}" đã tồn tại trên sản phẩm khác`), 409);
        } else {
          product.slug = formattedSlug;
        }
      }
    }

    if (body.sourceProductId !== undefined) {
      if (body.sourceProductId !== null && typeof body.sourceProductId !== "string") {
        return apiError(new Error("sourceProductId không hợp lệ"), 400);
      }
      const sourceId = typeof body.sourceProductId === "string" && body.sourceProductId.trim()
        ? body.sourceProductId.trim()
        : null;

      if (sourceId && sourceId !== product.sourceProductId) {
        const duplicateSource = await UsedProductModel.findOne({
          sourceProductId: sourceId,
          _id: { $ne: product._id },
        }).select("_id").lean();
        if (duplicateSource) {
          return apiError(new Error(`sourceProductId "${sourceId}" đã được liên kết với sản phẩm khác`), 409);
        }
      }
      product.sourceProductId = sourceId;
    }

    if (requestedName !== undefined && requestedName !== null) {
      product.name = requestedName;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string") return apiError(new Error("Mô tả không hợp lệ"), 400);
      product.description = body.description;
    }
    if (body.price !== undefined) {
      if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price < 0) {
        return apiError(new Error("Giá sản phẩm không hợp lệ"), 400);
      }
      product.price = body.price;
    }
    if (body.priceText !== undefined) {
      if (typeof body.priceText !== "string") {
        return apiError(new Error("Giá hiển thị không hợp lệ"), 400);
      }
      product.priceText = body.priceText;
    }
    if (body.category !== undefined) {
      if (typeof body.category !== "string") return apiError(new Error("Danh mục không hợp lệ"), 400);
      product.category = body.category.trim();
      // If the caller updates the category name without a slug, derive the slug automatically.
      if (body.categorySlug === undefined) {
        product.categorySlug = product.category
          ? slugifyText(product.category) || null
          : null;
      }
    }
    if (body.categorySlug !== undefined) {
      if (body.categorySlug !== null && typeof body.categorySlug !== "string") {
        return apiError(new Error("Slug danh mục con không hợp lệ"), 400);
      }
      product.categorySlug = typeof body.categorySlug === "string" && body.categorySlug.trim()
        ? slugifyText(body.categorySlug) || null
        : null;
    }
    if (body.parentCategory !== undefined) {
      if (body.parentCategory !== null && typeof body.parentCategory !== "string") {
        return apiError(new Error("Danh mục cha không hợp lệ"), 400);
      }
      product.parentCategory = typeof body.parentCategory === "string" && body.parentCategory.trim()
        ? body.parentCategory.trim()
        : null;
      if (body.parentCategorySlug === undefined) {
        product.parentCategorySlug = product.parentCategory
          ? slugifyText(product.parentCategory) || null
          : null;
      }
    }
    if (body.parentCategorySlug !== undefined) {
      if (body.parentCategorySlug !== null && typeof body.parentCategorySlug !== "string") {
        return apiError(new Error("Slug danh mục cha không hợp lệ"), 400);
      }
      product.parentCategorySlug = typeof body.parentCategorySlug === "string" && body.parentCategorySlug.trim()
        ? slugifyText(body.parentCategorySlug) || null
        : null;
    }
    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) return apiError(new Error("Danh sách hình ảnh không hợp lệ"), 400);
      product.images = normalizeImages(body.images);
    }
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !body.status.trim()) return apiError(new Error("Trạng thái không hợp lệ"), 400);
      product.status = body.status.trim();
    }
    if (body.pin !== undefined) {
      if (typeof body.pin !== "string") return apiError(new Error("Pin không hợp lệ"), 400);
      product.pin = body.pin;
    }
    if (body.isDone !== undefined) {
      if (typeof body.isDone !== "boolean") return apiError(new Error("isDone không hợp lệ"), 400);
      product.isDone = body.isDone;
      if (body.doneAt === undefined) {
        product.doneAt = body.isDone ? new Date().toISOString() : null;
      }
    }
    if (body.doneAt !== undefined) {
      if (body.doneAt !== null && typeof body.doneAt !== "string") return apiError(new Error("doneAt không hợp lệ"), 400);
      product.doneAt = body.doneAt;
    }

    await product.save();

    return jsonNoStore({
      ok: true,
      message: "Cập nhật sản phẩm thành công",
      product: { ...product.toObject(), _id: product._id.toString() },
    });
  } catch (error: unknown) {
    if (isVersionError(error)) {
      return apiError(new Error("Dữ liệu đã thay đổi trong lúc cập nhật. Hãy tải lại và thử lại."), 409);
    }
    if (isDuplicateKeyError(error)) {
      return apiError(new Error("Slug hoặc sourceProductId đã tồn tại trên sản phẩm khác"), 409);
    }
    return apiError(error, 400);
  }
}

export async function DELETE(request: Request, { params }: ParamsPromise) {
  try {
    await connectMongo();
    const lookupKey = await getLookupKey(request, params);
    if (!lookupKey) return apiError(new Error("Vui lòng cung cấp slug sản phẩm"), 400);

    const product = await findProductBySlugOrId(lookupKey);
    if (!product) return apiError(new Error("Không tìm thấy sản phẩm để xóa"), 404);

    await UsedProductModel.deleteOne({ _id: product._id });
    return jsonNoStore({
      ok: true,
      message: "Xóa sản phẩm thành công",
      deletedId: product._id.toString(),
      deletedSlug: product.slug,
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
