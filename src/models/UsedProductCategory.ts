import { Schema, model, models, type Model, type Document } from "mongoose";

export interface IUsedProductCategoryDoc extends Document {
  name: string;
  slug: string;
  parentSlug: string | null;
  description: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const usedProductCategorySchema = new Schema<IUsedProductCategoryDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    parentSlug: { type: String, default: null },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  {
    collection: "used_product_categories",
    timestamps: true,
  },
);

usedProductCategorySchema.index({ slug: 1, parentSlug: 1 }, { unique: true });

// Recompile after schema changes in development so legacy versionKey settings
// are not retained by the Mongoose model cache.
if (models.UsedProductCategory) {
  delete (models as Record<string, unknown>).UsedProductCategory;
}

const UsedProductCategoryModel: Model<IUsedProductCategoryDoc> = model<IUsedProductCategoryDoc>(
  "UsedProductCategory",
  usedProductCategorySchema,
);

export default UsedProductCategoryModel;
