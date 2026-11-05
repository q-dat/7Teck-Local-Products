import mongoose, { Schema, type Model } from "mongoose";

export interface ISystemControl {
  _id: string;
  enabled: boolean;
  revision: number;
  updatedAt: Date | null;
  updatedBy: string | null;
}

const SystemControlSchema = new Schema<ISystemControl>(
  {
    _id: {
      type: String,
      required: true,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    revision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: String,
      default: null,
    },
  },
  {
    collection: "system_controls",
    versionKey: false,
    timestamps: false,
    strict: "throw",
  },
);

const SystemControlModel: Model<ISystemControl> =
  (mongoose.models.SystemControl as Model<ISystemControl> | undefined) ??
  mongoose.model<ISystemControl>("SystemControl", SystemControlSchema);

export default SystemControlModel;
