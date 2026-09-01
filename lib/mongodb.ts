import mongoose from "mongoose";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  __localProductsMongoose?: MongooseCache;
};

const cache = globalWithMongoose.__localProductsMongoose ?? {
  connection: null,
  promise: null,
};

globalWithMongoose.__localProductsMongoose = cache;

export const connectMongo = async (): Promise<typeof mongoose> => {
  if (cache.connection) return cache.connection;

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("Thiếu biến môi trường MONGODB_URI");

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME?.trim() || "local_products",
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  try {
    cache.connection = await cache.promise;
    return cache.connection;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
};
