import mongoose from 'mongoose';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import logger from './src/config/logger.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Backend running on http://localhost:${PORT}`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(() => {
        mongoose.connection.close(false, () => process.exit(0));
      });
    };

    ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

export default app;
