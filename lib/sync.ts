import type { ClientSession } from "mongoose";

import { connectMongo } from "@/lib/mongodb";
import AppStateModel from "@/models/AppState";
import SyncChangeModel from "@/models/SyncChange";

export type SyncChangeEntity = "product" | "state" | "catalog";
export type SyncChangeOperation = "upsert" | "delete" | "reset";

export type SyncChangeInput = {
  entity: SyncChangeEntity;
  entityId: string;
  operation: SyncChangeOperation;
};

const MAIN_STATE_KEY = "main";

const normalizeSyncVersion = (value: unknown): number => {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : 0;
};

export const ensureSyncBaseline = async (): Promise<number> => {
  await connectMongo();

  await AppStateModel.updateOne(
    { key: MAIN_STATE_KEY },
    { $setOnInsert: { key: MAIN_STATE_KEY, syncVersion: 1 } },
    { upsert: true, runValidators: true },
  );

  const state = await AppStateModel.findOne(
    { key: MAIN_STATE_KEY },
    { _id: 0, syncVersion: 1 },
  ).lean();
  const currentVersion = normalizeSyncVersion(
    (state as { syncVersion?: unknown } | null)?.syncVersion,
  );

  if (currentVersion > 0) {
    if (currentVersion === 1) {
      await SyncChangeModel.updateOne(
        { revision: 1 },
        {
          $setOnInsert: {
            revision: 1,
            entity: "catalog",
            entityId: MAIN_STATE_KEY,
            operation: "reset",
          },
        },
        { upsert: true, runValidators: true },
      );
    }
    return currentVersion;
  }

  const initialized = await AppStateModel.findOneAndUpdate(
    {
      key: MAIN_STATE_KEY,
      $or: [
        { syncVersion: { $exists: false } },
        { syncVersion: { $lte: 0 } },
      ],
    },
    { $set: { syncVersion: 1 } },
    { new: true, projection: { _id: 0, syncVersion: 1 }, runValidators: true },
  ).lean();

  const initializedVersion = normalizeSyncVersion(
    (initialized as { syncVersion?: unknown } | null)?.syncVersion,
  );

  if (initializedVersion > 0) {
    await SyncChangeModel.updateOne(
      { revision: initializedVersion },
      {
        $setOnInsert: {
          revision: initializedVersion,
          entity: "catalog",
          entityId: MAIN_STATE_KEY,
          operation: "reset",
        },
      },
      { upsert: true, runValidators: true },
    );
    return initializedVersion;
  }

  const refreshedState = await AppStateModel.findOne(
    { key: MAIN_STATE_KEY },
    { _id: 0, syncVersion: 1 },
  ).lean();
  const refreshedVersion = normalizeSyncVersion(
    (refreshedState as { syncVersion?: unknown } | null)?.syncVersion,
  );

  if (refreshedVersion === 0) {
    throw new Error("Không thể khởi tạo phiên bản đồng bộ dữ liệu");
  }

  return refreshedVersion;
};

const reserveSyncRevision = async (
  session: ClientSession,
): Promise<number> => {
  const state = await AppStateModel.findOneAndUpdate(
    { key: MAIN_STATE_KEY },
    { $inc: { syncVersion: 1 }, $setOnInsert: { key: MAIN_STATE_KEY } },
    {
      new: true,
      upsert: true,
      projection: { _id: 0, syncVersion: 1 },
      runValidators: true,
      session,
    },
  ).lean();
  const version = normalizeSyncVersion(
    (state as { syncVersion?: unknown } | null)?.syncVersion,
  );

  if (version === 0) {
    throw new Error("Không thể tạo phiên bản đồng bộ mới");
  }

  return version;
};

export const runWithSyncChange = async <T>(
  change: SyncChangeInput,
  mutate: (session: ClientSession) => Promise<T>,
): Promise<{ value: T; syncVersion: number }> => {
  const connection = await connectMongo();
  await ensureSyncBaseline();

  const session = await connection.startSession();
  let value: T | undefined;
  let syncVersion = 0;

  try {
    await session.withTransaction(async () => {
      syncVersion = await reserveSyncRevision(session);
      value = await mutate(session);
      await SyncChangeModel.create(
        [
          {
            revision: syncVersion,
            entity: change.entity,
            entityId: change.entityId,
            operation: change.operation,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (value === undefined || syncVersion === 0) {
    throw new Error("Không thể hoàn tất đồng bộ thay đổi dữ liệu");
  }

  return { value, syncVersion };
};
