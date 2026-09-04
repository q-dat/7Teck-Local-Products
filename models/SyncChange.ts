import { Schema, model, models } from "mongoose";

const syncChangeSchema = new Schema(
  {
    revision: { type: Number, required: true, unique: true, index: true },
    entity: {
      type: String,
      enum: ["product", "state", "catalog"],
      required: true,
    },
    entityId: { type: String, required: true },
    operation: {
      type: String,
      enum: ["upsert", "trash", "delete", "reset"],
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "local_product_sync_changes", versionKey: false },
);

const SyncChangeModel =
  models.LocalProductSyncChange ||
  model("LocalProductSyncChange", syncChangeSchema);

export default SyncChangeModel;
