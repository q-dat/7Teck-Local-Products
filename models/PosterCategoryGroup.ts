import { Schema, model, models } from "mongoose";

const PRODUCT_CONTENT_TYPES = [
  "technology",
  "realEstate",
  "rental",
  "propertyRental",
] as const;

const posterCategoryGroupSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    contentType: {
      type: String,
      enum: [...PRODUCT_CONTENT_TYPES],
      required: true,
      index: true,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "poster_category_groups", versionKey: false, id: false },
);

const PosterCategoryGroupModel =
  models.LocalProductPosterCategoryGroup ||
  model("LocalProductPosterCategoryGroup", posterCategoryGroupSchema);

export default PosterCategoryGroupModel;
