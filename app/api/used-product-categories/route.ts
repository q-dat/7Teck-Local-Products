import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import { slugifyText } from "@/lib/slug";
import UsedProductCategoryModel from "@/models/UsedProductCategory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CategoryInput {
  name?: string;
  slug?: string;
  parentSlug?: string | null;
  description?: string;
  order?: number;
}

interface CategoryTreeItem {
  _id: string;
  name: string;
  slug: string;
  parentSlug: string | null;
  description: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  children: CategoryTreeItem[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isDuplicateKeyError = (error: unknown): boolean =>
  isRecord(error) && error.code === 11000;

const serializeDate = (value: Date | string | undefined): string | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export async function GET(request: Request) {
  try {
    await connectMongo();
    const { searchParams } = new URL(request.url);
    const requestedSlug = searchParams.get("slug")?.trim();

    if (requestedSlug) {
      const query: Record<string, unknown> = { slug: requestedSlug };
      if (searchParams.has("parentSlug")) {
        query.parentSlug = searchParams.get("parentSlug")?.trim() || null;
      }

      const matches = await UsedProductCategoryModel.find(query).limit(2);
      if (matches.length === 0) return apiError(new Error("Không tìm thấy danh mục"), 404);
      if (matches.length > 1) {
        return apiError(new Error("Slug danh mục chưa xác định duy nhất; hãy truyền parentSlug"), 409);
      }

      const category = matches[0];
      if (!category) return apiError(new Error("Không tìm thấy danh mục"), 404);

      return jsonNoStore({
        ok: true,
        category: { ...category.toObject(), _id: category._id.toString() },
      });
    }

    const rawCategories = await UsedProductCategoryModel.find({})
      .sort({ order: 1, createdAt: 1, _id: 1 })
      .lean();

    const categories = rawCategories.map((category) => ({
      _id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      parentSlug: category.parentSlug || null,
      description: category.description || "",
      order: category.order ?? 0,
      createdAt: serializeDate(category.createdAt),
      updatedAt: serializeDate(category.updatedAt),
    }));

    const parentMap = new Map<string, CategoryTreeItem>();
    const tree: CategoryTreeItem[] = [];
    const children: typeof categories = [];

    for (const category of categories) {
      if (category.parentSlug === null) {
        const parent: CategoryTreeItem = { ...category, children: [] };
        parentMap.set(parent.slug, parent);
        tree.push(parent);
      } else {
        children.push(category);
      }
    }

    for (const category of children) {
      const child: CategoryTreeItem = { ...category, children: [] };
      const parent = category.parentSlug ? parentMap.get(category.parentSlug) : undefined;
      if (parent) parent.children.push(child);
      else tree.push(child);
    }

    return jsonNoStore({
      ok: true,
      count: categories.length,
      categories,
      tree,
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectMongo();
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return apiError(new Error("Dữ liệu danh mục không hợp lệ"), 400);

    const body = rawBody as CategoryInput;
    if (typeof body.name !== "string" || !body.name.trim()) {
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

    const name = body.name.trim();
    const slug = slugifyText(body.slug?.trim() || name);
    if (!slug) return apiError(new Error("Không thể tạo slug từ tên danh mục"), 400);

    let parentSlug: string | null = null;
    if (body.parentSlug !== undefined && body.parentSlug !== null && body.parentSlug !== "") {
      if (typeof body.parentSlug !== "string") {
        return apiError(new Error("parentSlug không hợp lệ"), 400);
      }
      const parent = await UsedProductCategoryModel.findOne({
        slug: body.parentSlug.trim(),
        parentSlug: null,
      }).select("slug").lean();
      if (!parent) {
        return apiError(new Error(`Danh mục cha "${body.parentSlug}" không tồn tại`), 400);
      }
      parentSlug = parent.slug;
    }

    const existing = await UsedProductCategoryModel.findOne({ slug, parentSlug }).select("_id").lean();
    if (existing) {
      const scope = parentSlug ? `trong danh mục cha "${parentSlug}"` : "ở cấp danh mục gốc";
      return apiError(new Error(`Danh mục với slug "${slug}" đã tồn tại ${scope}`), 409);
    }

    const category = await UsedProductCategoryModel.create({
      name,
      slug,
      parentSlug,
      description: body.description || "",
      order: typeof body.order === "number" ? body.order : 0,
    });

    return jsonNoStore({
      ok: true,
      message: "Tạo danh mục thành công",
      category: { ...category.toObject(), _id: category._id.toString() },
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return apiError(new Error("Slug danh mục đã tồn tại trong nhóm này"), 409);
    }
    return apiError(error, 400);
  }
}
