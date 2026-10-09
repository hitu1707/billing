import mongoose from 'mongoose';
import logger from './logger.js';

// Cached so warm serverless invocations reuse the same connection instead of
// opening a new one on every request.
let connectionPromise = null;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI)
      .then(() => {
        logger.info('MongoDB Connected Successfully');
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw new Error(`MongoDB Connection Failed: ${error.message}`);
      });
  }

  return connectionPromise;
};

export default connectDB;
