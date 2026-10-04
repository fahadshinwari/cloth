import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

/**
 * Cached Mongoose connection (prevents connection storms in dev hot-reload).
 */
const globalForMongoose = globalThis as unknown as { mongoose?: MongooseCache };

const cache: MongooseCache =
  globalForMongoose.mongoose ?? (globalForMongoose.mongoose = { conn: null, promise: null });

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
    };

    cache.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongoose) => mongoose);
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
