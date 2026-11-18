import { destroyCloudinaryImages } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";
import {
  ensureLegacyProductIdMigration,
  getProductPublicIds,
  isMongoObjectIdString,
  serializeProductRecord,
  validateProductInput,
} from "@/lib/products";
import { runWithSyncChange } from "@/lib/sync";
import AppStateModel from "@/models/AppState";
import ProductModel from "@/models/Product";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const legacyIdMap = await ensureLegacyProductIdMigration();
    const products = await ProductModel.find({}).sort({ updatedAt: -1 }).lean();
    return jsonNoStore({
      ok: true,
      products: products.map(serializeProductRecord),
      legacyIdMap,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const product = validateProductInput(await request.json());
    await ensureLegacyProductIdMigration();

    const mongoId = new Types.ObjectId();
    const { value: createdProduct, syncVersion } = await runWithSyncChange(
      {
        entity: "product",
        entityId: mongoId.toHexString(),
        operation: "upsert",
      },
      async (session) => {
        const document = new ProductModel({ ...product, _id: mongoId });
        await document.save({ session });
        return document.toObject();
      },
    );

    return jsonNoStore({
      ok: true,
      product: serializeProductRecord(createdProduct),
      syncVersion,
    });
  } catch (error) {
    return apiError(error, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      products?: unknown;
    };
    if (!Array.isArray(body.products)) {
      return apiError(new Error("Dữ liệu import thiếu products"), 400);
    }

    const rawProducts = body.products as unknown[];
    const products = rawProducts.map((value) => {
      if (!value || typeof value !== "object") {
        throw new Error("Sản phẩm import không hợp lệ");
      }

      const record = value as Record<string, unknown>;
      const suppliedId = record._id;
      if (suppliedId !== undefined && !isMongoObjectIdString(suppliedId)) {
        throw new Error("_id sản phẩm import không hợp lệ");
      }

      return {
        data: validateProductInput(value),
        mongoId: typeof suppliedId === "string" ? suppliedId.toLowerCase() : null,
        legacyId:
          (typeof record.legacyId === "string" && record.legacyId.trim()) ||
          (typeof record.id === "string" && record.id.trim()) ||
          "",
      };
    });

    const suppliedIds = products.flatMap((product) =>
      product.mongoId ? [product.mongoId] : [],
    );
    if (new Set(suppliedIds).size !== suppliedIds.length) {
      return apiError(new Error("File import có _id sản phẩm bị trùng"), 400);
    }

    const existingLegacyIdMap = await ensureLegacyProductIdMigration();
    const { value: result, syncVersion } = await runWithSyncChange(
      { entity: "catalog", entityId: "main", operation: "reset" },
      async (session) => {
        const previous = await ProductModel.find({})
          .session(session)
          .lean();

        const legacyIdMap = { ...existingLegacyIdMap };
        const assignedProducts = products.map((product) => {
          const matchedLegacyId = product.legacyId
            ? legacyIdMap[product.legacyId]
            : undefined;
          const mongoId = product.mongoId ?? matchedLegacyId ?? new Types.ObjectId().toHexString();

          if (product.legacyId) legacyIdMap[product.legacyId] = mongoId;
          return { ...product.data, _id: new Types.ObjectId(mongoId) };
        });
        const assignedIds = assignedProducts.map((product) => product._id.toHexString());
        if (new Set(assignedIds).size !== assignedIds.length) {
          throw new Error("File import có sản phẩm trùng _id MongoDB");
        }

        if (assignedProducts.length > 0) {
          await ProductModel.bulkWrite(
            assignedProducts.map((product) => ({
              replaceOne: {
                filter: { _id: product._id },
                replacement: product,
                upsert: true,
              },
            })),
            { ordered: true, session },
          );
          await ProductModel.deleteMany(
            { _id: { $nin: assignedProducts.map((product) => product._id) } },
            { session },
          );
        } else {
          await ProductModel.deleteMany({}, { session });
        }

        const savedProducts = assignedProducts.length > 0
          ? await ProductModel.find({ _id: { $in: assignedProducts.map((product) => product._id) } })
              .session(session)
              .lean()
          : [];

        await AppStateModel.updateOne(
          { key: "main" },
          {
            $set: { legacyProductIdMap: legacyIdMap },
            $setOnInsert: { key: "main" },
          },
          { upsert: true, runValidators: true, session },
        );

        return { previous, products: savedProducts, legacyIdMap };
      },
    );

    const currentPublicIds = new Set(result.products.flatMap(getProductPublicIds));
    const obsoletePublicIds = result.previous
      .flatMap(getProductPublicIds)
      .filter((publicId) => !currentPublicIds.has(publicId));
    const cleanup = await destroyCloudinaryImages(obsoletePublicIds);

    return jsonNoStore({
      ok: true,
      count: products.length,
      products: result.products.map(serializeProductRecord),
      legacyIdMap: result.legacyIdMap,
      cleanup,
      syncVersion,
    });
  } catch (error) {
    return apiError(error, 400);
  }
}
