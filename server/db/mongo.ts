import mongoose from 'mongoose';

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectMongo(): Promise<void> {
  if (isMongoConnected()) return;

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dataguard';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err: any) {
    console.warn(
      `MongoDB is not running at ${uri} (${err.message}). Accounts will be stored in tmp/dataguard-auth.json until MONGODB_URI points to a reachable MongoDB server.`
    );
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
