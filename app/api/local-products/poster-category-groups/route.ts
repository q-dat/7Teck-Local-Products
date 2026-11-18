import { apiError, jsonNoStore } from "@/lib/http";
import { connectMongo } from "@/lib/mongodb";
import PosterCategoryGroupModel from "@/models/PosterCategoryGroup";
import type { ProductContentType } from "@/types/local-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES = new Set<ProductContentType>([
  "technology",
  "realEstate",
  "rental",
  "propertyRental",
]);

const parseContentType = (value: unknown): ProductContentType | null =>
  typeof value === "string" && CONTENT_TYPES.has(value as ProductContentType)
    ? (value as ProductContentType)
    : null;

const normalizeCategoryGroupName = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ");

const createCategoryGroupKey = (
  contentType: ProductContentType,
  name: string,
): string => `${contentType}:${name.toLocaleLowerCase("vi-VN")}`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contentType = parseContentType(url.searchParams.get("contentType"));
    if (!contentType) {
      return apiError(new Error("contentType không hợp lệ"), 400);
    }

    await connectMongo();
    const groups = await PosterCategoryGroupModel.find(
      { contentType },
      { _id: 1, name: 1 },
    )
      .sort({ name: 1 })
      .lean();

    return jsonNoStore({
      ok: true,
      groups: groups.map((group) => ({
        _id: String(group._id),
        name: group.name,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      contentType?: unknown;
      name?: unknown;
      names?: unknown;
    };
    const contentType = parseContentType(body.contentType);
    if (!contentType) {
      return apiError(new Error("contentType không hợp lệ"), 400);
    }

    const rawNames = [
      ...(typeof body.name === "string" ? [body.name] : []),
      ...(Array.isArray(body.names) ? body.names : []),
    ];
    const namesByKey = new Map<string, string>();

    for (const rawName of rawNames) {
      if (typeof rawName !== "string") continue;
      const name = normalizeCategoryGroupName(rawName);
      if (!name || name.length > 100) continue;
      namesByKey.set(createCategoryGroupKey(contentType, name), name);
    }

    if (namesByKey.size === 0) {
      return apiError(new Error("Cần ít nhất một danh mục lớn hợp lệ"), 400);
    }

    await connectMongo();
    const now = new Date();
    await PosterCategoryGroupModel.bulkWrite(
      Array.from(namesByKey, ([key, name]) => ({
        updateOne: {
          filter: { key },
          update: {
            $set: { key, name, contentType, updatedAt: now },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      })),
      { ordered: true },
    );

    const groups = await PosterCategoryGroupModel.find(
      { contentType },
      { _id: 1, name: 1 },
    )
      .sort({ name: 1 })
      .lean();

    return jsonNoStore({
      ok: true,
      groups: groups.map((group) => ({
        _id: String(group._id),
        name: group.name,
      })),
    });
  } catch (error) {
    return apiError(error, 400);
  }
}
