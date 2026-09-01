import { Schema, model, models } from "mongoose";

const productImageSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    originalName: { type: String, default: "" },
    dataUrl: { type: String, required: true },
    size: { type: Number, required: true },
    type: { type: String, required: true },
    createdAt: { type: String, required: true },
    publicId: { type: String, required: true, index: true },
    assetId: { type: String, default: "" },
    version: { type: Number, default: 0 },
    format: { type: String, default: "" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    etag: { type: String, default: "" },
    sha256: { type: String, default: "" },
    resourceType: { type: String, default: "image" },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    pin: { type: String, default: "" },
    status: { type: String, default: "" },
    price: { type: Number, default: 0 },
    priceText: { type: String, default: "" },
    category: { type: String, default: "" },
    contentType: { type: String, enum: ["technology", "realEstate"], default: "technology" },
    realEstateComment: { type: String, default: "" },
    images: { type: [productImageSchema], default: [] },
    internalImages: { type: [productImageSchema], default: [] },
    isDone: { type: Boolean, default: false },
    doneAt: { type: String, default: "" },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true, index: true },
  },
  { collection: "products", versionKey: false },
);

const ProductModel = models.LocalProduct || model("LocalProduct", productSchema);
export default ProductModel;
