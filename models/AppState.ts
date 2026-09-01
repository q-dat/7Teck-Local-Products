import { Schema, model, models } from "mongoose";

const appStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    settings: { type: Schema.Types.Mixed, default: null },
    scheduleConfig: { type: Schema.Types.Mixed, default: null },
    scheduleAssignments: { type: Schema.Types.Mixed, default: {} },
    postedRecords: { type: [Schema.Types.Mixed], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "app_state", versionKey: false },
);

const AppStateModel = models.LocalProductAppState || model("LocalProductAppState", appStateSchema);
export default AppStateModel;
