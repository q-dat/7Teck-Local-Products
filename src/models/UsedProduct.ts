import { Schema, model, models, type Model, type Document } from "mongoose";

export interface IUsedProductDoc extends Document {
  name: string;
  slug: string;
  sourceProductId: string | null;
  description: string;
  price: number;
  priceText: string;
  category: string;
  parentCategory: string | null;
  parentCategorySlug: string | null;
  images: unknown[];
  status: string;
  pin: string;
  sourceNameSnapshot: string;
  sourceDescriptionSnapshot: string;
  isDone: boolean;
  doneAt: string | null;
  createdAt: Date;
  updatedAt: Date;
  __v: number;
}

const usedProductSchema = new Schema<IUsedProductDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    // Uniqueness is defined by the partial index below so that multiple nulls are allowed.
    sourceProductId: { type: String, default: null, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, default: 0, min: 0 },
    priceText: { type: String, default: "" },
    category: { type: String, default: "" },
    parentCategory: { type: String, default: null },
    parentCategorySlug: { type: String, default: null },
    // Mixed preserves compatibility with legacy image objects while API writes normalize URLs.
    images: { type: [Schema.Types.Mixed], default: [] },
    status: { type: String, default: "active" },
    pin: { type: String, default: "" },
    sourceNameSnapshot: { type: String, default: "" },
    sourceDescriptionSnapshot: { type: String, default: "" },
    isDone: { type: Boolean, default: false },
    doneAt: { type: String, default: null },
  },
  {
    collection: "used_products",
    timestamps: true,
    versionKey: "__v",
    optimisticConcurrency: true,
  },
);

usedProductSchema.index(
  { sourceProductId: 1 },
  {
    name: "sourceProductId_unique_string",
    unique: true,
    partialFilterExpression: { sourceProductId: { $type: "string" } },
  },
);

// Recompile the model when this module is reloaded so changes to the version key
// and partial unique index are not hidden behind a stale development model cache.
if (models.UsedProduct) {
  delete (models as Record<string, unknown>).UsedProduct;
}

const UsedProductModel: Model<IUsedProductDoc> = model<IUsedProductDoc>(
  "UsedProduct",
  usedProductSchema,
);

export default UsedProductModel;
