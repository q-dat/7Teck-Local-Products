import { Schema, model, models } from "mongoose";

const appStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    settings: { type: Schema.Types.Mixed, default: null },
    legacyProductIdMap: { type: Schema.Types.Mixed, default: {} },
    syncVersion: { type: Number, default: 0, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "app_state", versionKey: false, id: false },
);

const AppStateModel = models.LocalProductAppState || model("LocalProductAppState", appStateSchema);
export default AppStateModel;
