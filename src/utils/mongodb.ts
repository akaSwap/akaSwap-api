import { MongoClient } from 'mongodb';
import config from '../config/config';

const MONGODB_URI = `mongodb://${config.mongodbUsername}:${config.mongodbPassword}@${config.mongodbUrl}`;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (<any>global).mongo;

if (!cached) {
  cached = (<any>global).mongo = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    cached.promise = MongoClient.connect(MONGODB_URI, opts).then((client) => {
      return client
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
