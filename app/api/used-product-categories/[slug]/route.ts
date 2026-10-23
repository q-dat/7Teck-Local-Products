import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { slugifyText } from "@/lib/slug";
import UsedProductCategoryModel, { type IUsedProductCategoryDoc } from "@/models/UsedProductCategory";
import UsedProductModel, { type IUsedProductDoc } from "@/models/UsedProduct";
import mongoose from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsPromise = {
  params: Promise<{ slug: string }>;
};

interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  parentSlug?: string | null;
  currentParentSlug?: string | null;
  description?: string;
  order?: number;
}

interface ParentScope {
  provided: boolean;
  slug: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isDuplicateKeyError = (error: unknown): boolean =>
  isRecord(error) && error.code === 11000;

const normalizeParentSlug = (value: string | null | undefined): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function getParentScope(searchParams: URLSearchParams): ParentScope {
  return {
    provided: searchParams.has("parentSlug"),
    slug: normalizeParentSlug(searchParams.get("parentSlug")),
  };
}

function categoryJson(category: IUsedProductCategoryDoc) {
  return { ...category.toObject(), _id: category._id.toString() };
}

async function findCategory(
  slugOrId: string,
  parentScope: ParentScope,
) {
  const key = slugOrId.trim();
  if (!key) return { category: null, ambiguous: false };

  if (/^[0-9a-fA-F]{24}$/.test(key) && mongoose.Types.ObjectId.isValid(key)) {
    const byId = await UsedProductCategoryModel.findById(key);
    if (byId) {
      const parentMatches = !parentScope.provided ||
        normalizeParentSlug(byId.parentSlug) === parentScope.slug;
      return { category: parentMatches ? byId : null, ambiguous: false };
    }
  }

  const query: Record<string, unknown> = { slug: key };
  if (parentScope.provided) query.parentSlug = parentScope.slug;

  const matches = await UsedProductCategoryModel.find(query).limit(2);
  if (matches.length > 1) return { category: null, ambiguous: true };
  return { category: matches[0] ?? null, ambiguous: false };
}

function ambiguousResponse(): Response {
  return apiError(
    new Error("Slug danh mục chưa xác định duy nhất. Hãy truyền parentSlug để chọn đúng danh mục."),
    409,
  );
}

export async function GET(request: Request, { params }: ParamsPromise) {
  try {
    await connectMongo();
    const { slug: routeSlug } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("slug")?.trim() || routeSlug.trim();
    const result = await findCategory(key, getParentScope(searchParams));

    if (result.ambiguous) return ambiguousResponse();
    if (!result.category) return apiError(new Error("Không tìm thấy danh mục"), 404);

    return jsonNoStore({ ok: true, category: categoryJson(result.category) });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: ParamsPromise) {
  try {
    await connectMongo();
    const { slug: routeSlug } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("slug")?.trim() || routeSlug.trim();

    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return apiError(new Error("Dữ liệu cập nhật danh mục không hợp lệ"), 400);
    const body = rawBody as CategoryUpdateInput;

    let parentScope = getParentScope(searchParams);
    if (Object.prototype.hasOwnProperty.call(rawBody, "currentParentSlug")) {
      if (body.currentParentSlug !== null && typeof body.currentParentSlug !== "string") {
        return apiError(new Error("currentParentSlug không hợp lệ"), 400);
      }
      parentScope = { provided: true, slug: normalizeParentSlug(body.currentParentSlug) };
    }

    const lookup = await findCategory(key, parentScope);
    if (lookup.ambiguous) return ambiguousResponse();
    const category = lookup.category;
    if (!category) return apiError(new Error("Không tìm thấy danh mục để cập nhật"), 404);

    if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
      return apiError(new Error("Tên danh mục không được để trống"), 400);
    }
    if (body.slug !== undefined && typeof body.slug !== "string") {
      return apiError(new Error("Slug danh mục không hợp lệ"), 400);
    }
    if (body.description !== undefined && typeof body.description !== "string") {
      return apiError(new Error("Mô tả danh mục không hợp lệ"), 400);
    }
    if (body.order !== undefined && (typeof body.order !== "number" || !Number.isFinite(body.order))) {
      return apiError(new Error("Thứ tự danh mục không hợp lệ"), 400);
    }
    if (body.parentSlug !== undefined && body.parentSlug !== null && typeof body.parentSlug !== "string") {
      return apiError(new Error("parentSlug không hợp lệ"), 400);
    }

    const oldSlug = category.slug;
    const oldName = category.name;
    const oldParentSlug = normalizeParentSlug(category.parentSlug);
    const oldIsRoot = oldParentSlug === null;
    const cleanName = typeof body.name === "string" ? body.name.trim() : undefined;

    let newSlug = oldSlug;
    if (typeof body.slug === "string" && body.slug.trim()) {
      newSlug = slugifyText(body.slug.trim());
    } else if (cleanName !== undefined && !body.slug) {
      newSlug = slugifyText(cleanName);
    }
    if (!newSlug) return apiError(new Error("Không thể tạo slug từ tên danh mục"), 400);

    let newParentSlug = oldParentSlug;
    let newParentName: string | null = null;
    if (body.parentSlug !== undefined) {
      const requestedParent = normalizeParentSlug(body.parentSlug);
      if (requestedParent) {
        const parent = await UsedProductCategoryModel.findOne({ slug: requestedParent, parentSlug: null })
          .select("_id slug name")
          .lean();
        if (!parent) return apiError(new Error(`Danh mục cha "${requestedParent}" không tồn tại`), 400);
        if (parent._id.toString() === category._id.toString()) {
          return apiError(new Error("Danh mục không thể là cha của chính nó"), 400);
        }
        newParentSlug = parent.slug;
        newParentName = parent.name;
      } else {
        newParentSlug = null;
        newParentName = null;
      }
    } else if (oldParentSlug) {
      const existingParent = await UsedProductCategoryModel.findOne({
        slug: oldParentSlug,
        parentSlug: null,
      }).select("name").lean();
      newParentName = existingParent?.name ?? null;
    }

    if (oldIsRoot && newParentSlug !== null) {
      const childCount = await UsedProductCategoryModel.countDocuments({ parentSlug: oldSlug });
      if (childCount > 0) {
        return apiError(new Error("Không thể chuyển danh mục cha thành danh mục con khi còn danh mục con trực thuộc"), 409);
      }
    }

    const collision = await UsedProductCategoryModel.findOne({
      slug: newSlug,
      parentSlug: newParentSlug,
      _id: { $ne: category._id },
    }).select("_id").lean();
    if (collision) {
      return apiError(new Error(`Danh mục với slug "${newSlug}" đã tồn tại trong nhóm này`), 409);
    }

    const slugChanged = oldSlug !== newSlug;
    if (oldIsRoot && slugChanged) {
      const [currentChildren, destinationChildren] = await Promise.all([
        UsedProductCategoryModel.find({ parentSlug: oldSlug }).select("slug").lean(),
        UsedProductCategoryModel.find({ parentSlug: newSlug }).select("slug").lean(),
      ]);
      const destinationSlugs = new Set(destinationChildren.map((child) => child.slug));
      if (currentChildren.some((child) => destinationSlugs.has(child.slug))) {
        return apiError(
          new Error("Không thể đổi slug danh mục cha vì slug của danh mục con sẽ bị trùng"),
          409,
        );
      }
    }

    category.slug = newSlug;
    category.parentSlug = newParentSlug;
    if (cleanName !== undefined) category.name = cleanName;
    if (body.description !== undefined) category.description = body.description;
    if (body.order !== undefined) category.order = body.order;

    await category.save();

    if (oldIsRoot && slugChanged) {
      await UsedProductCategoryModel.updateMany(
        { parentSlug: oldSlug },
        { $set: { parentSlug: newSlug }, $inc: { __v: 1 } },
      );
    }

    const newName = category.name;
    const rootAssignmentsChanged = oldIsRoot && (
      oldName !== newName || newParentSlug !== oldParentSlug
    );
    const childAssignmentsChanged = !oldIsRoot && (
      oldName !== newName || newParentSlug !== oldParentSlug
    );

    if (rootAssignmentsChanged || childAssignmentsChanged) {
      const productFilter: Record<string, unknown> = oldIsRoot
        ? { category: oldName, parentCategorySlug: null }
        : { category: oldName, parentCategorySlug: oldParentSlug };
      const productUpdates: Partial<Pick<IUsedProductDoc, "category" | "parentCategory" | "parentCategorySlug">> = {};

      if (oldName !== newName) productUpdates.category = newName;
      if (newParentSlug !== oldParentSlug) {
        productUpdates.parentCategory = newParentName;
        productUpdates.parentCategorySlug = newParentSlug;
      }
      if (oldIsRoot && newParentSlug !== null) {
        productUpdates.parentCategory = newParentName;
        productUpdates.parentCategorySlug = newParentSlug;
      }

      if (Object.keys(productUpdates).length > 0) {
        await UsedProductModel.updateMany(
          productFilter,
          { $set: productUpdates, $inc: { __v: 1 } },
        );
      }
    }

    // Products assigned to children reference their parent by parentCategorySlug.
    // Keep both the parent name and the parent slug synchronized after a root rename.
    if (oldIsRoot && (slugChanged || oldName !== newName)) {
      const childProductUpdates: Partial<Pick<IUsedProductDoc, "parentCategory" | "parentCategorySlug">> = {};
      if (slugChanged) childProductUpdates.parentCategorySlug = newSlug;
      if (oldName !== newName) childProductUpdates.parentCategory = newName;

      if (Object.keys(childProductUpdates).length > 0) {
        await UsedProductModel.updateMany(
          { parentCategorySlug: oldSlug },
          { $set: childProductUpdates, $inc: { __v: 1 } },
        );
      }
    }

    return jsonNoStore({
      ok: true,
      message: "Cập nhật danh mục thành công",
      category: categoryJson(category),
      slugChanged,
      parentChanged: oldParentSlug !== newParentSlug,
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return apiError(new Error("Slug danh mục đã tồn tại trong nhóm này"), 409);
    }
    return apiError(error, 400);
  }
}

export async function DELETE(request: Request, { params }: ParamsPromise) {
  try {
    await connectMongo();
    const { slug: routeSlug } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("slug")?.trim() || routeSlug.trim();
    const result = await findCategory(key, getParentScope(searchParams));

    if (result.ambiguous) return ambiguousResponse();
    const category = result.category;
    if (!category) return apiError(new Error("Không tìm thấy danh mục để xóa"), 404);

    const deletedSlug = category.slug;
    const deletedName = category.name;
    const parentSlug = normalizeParentSlug(category.parentSlug);
    const isRoot = parentSlug === null;

    const childCategories = isRoot
      ? await UsedProductCategoryModel.find({ parentSlug: deletedSlug })
          .select("_id slug name")
          .lean()
      : [];

    const childResult = isRoot
      ? await UsedProductCategoryModel.deleteMany({ parentSlug: deletedSlug })
      : { deletedCount: 0 };
    const deleted = await UsedProductCategoryModel.deleteOne({ _id: category._id });

    if (deleted.deletedCount === 0) {
      return apiError(new Error("Danh mục không còn tồn tại để xóa"), 404);
    }

    const productFilter: Record<string, unknown> = isRoot
      ? {
          $or: [
            { parentCategorySlug: deletedSlug },
            { category: deletedName, parentCategorySlug: null },
          ],
        }
      : {
          category: deletedName,
          parentCategorySlug: parentSlug,
        };

    const productsUpdated = await UsedProductModel.updateMany(
      productFilter,
      {
        $set: {
          category: "",
          parentCategory: null,
          parentCategorySlug: null,
        },
        $inc: { __v: 1 },
      },
    );

    return jsonNoStore({
      ok: true,
      message: "Xóa danh mục thành công",
      deletedId: category._id.toString(),
      deletedSlug,
      childrenDeleted: childResult.deletedCount || 0,
      productsUncategorized: productsUpdated.modifiedCount,
      removedChildSlugs: childCategories.map((child) => child.slug),
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
