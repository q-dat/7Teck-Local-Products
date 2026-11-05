import { connectMongo } from "@/lib/mongodb";
import {
  API_GUARD_DOCUMENT_KEY,
  DEFAULT_API_GUARD_STATE,
  type ApiGuardState,
} from "@/lib/api-guard/contracts";
import SystemControlModel from "@/models/SystemControl";

function toApiGuardState(record: {
  enabled: boolean;
  revision: number;
  updatedAt: Date | null;
  updatedBy: string | null;
}): ApiGuardState {
  return {
    enabled: record.enabled,
    mode: "decoy",
    revision: record.revision,
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
    updatedBy: record.updatedBy,
  };
}

/**
 * Reads the single shared guard document from MongoDB.
 * No process-local state is used, so separate Vercel instances see the same value.
 */
export async function getApiGuardState(): Promise<ApiGuardState> {
  await connectMongo();

  const record = await SystemControlModel.findOneAndUpdate(
    { _id: API_GUARD_DOCUMENT_KEY },
    {
      $setOnInsert: {
        enabled: DEFAULT_API_GUARD_STATE.enabled,
        revision: DEFAULT_API_GUARD_STATE.revision,
        updatedAt: null,
        updatedBy: null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .select({ enabled: 1, revision: 1, updatedAt: 1, updatedBy: 1 })
    .lean()
    .exec();

  if (!record) return DEFAULT_API_GUARD_STATE;
  return toApiGuardState(record);
}

/**
 * Atomically updates the shared state and increments its revision.
 */
export async function setApiGuardState(
  enabled: boolean,
  updatedBy: string,
): Promise<ApiGuardState> {
  await connectMongo();

  const record = await SystemControlModel.findOneAndUpdate(
    { _id: API_GUARD_DOCUMENT_KEY },
    {
      $set: {
        enabled,
        updatedAt: new Date(),
        updatedBy,
      },
      $inc: { revision: 1 },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
    .select({ enabled: 1, revision: 1, updatedAt: 1, updatedBy: 1 })
    .lean()
    .exec();

  if (!record) {
    throw new Error("Không thể cập nhật trạng thái API Guard trong MongoDB");
  }

  return toApiGuardState(record);
}
