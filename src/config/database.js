import mongoose from "mongoose";
import config from "./index.js";
import { logger } from "../utils/logger.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

mongoose.set("strictQuery", true);

const connectionOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

mongoose.connection.on("connected", () => {
  logger.info("MongoDB connected");
});

mongoose.connection.on("error", (error) => {
  logger.error("MongoDB connection error", error);
});

mongoose.connection.on("disconnected", () => {
  logger.info("MongoDB disconnected");
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async (attempt = 1) => {
  try {
    await mongoose.connect(config.mongo.uri, connectionOptions);
    return mongoose.connection;
  } catch (error) {
    logger.error(`MongoDB connection attempt ${attempt} failed`, error);
    if (attempt >= MAX_RETRIES) {
      throw error;
    }
    await sleep(RETRY_DELAY_MS * attempt);
    return connectDB(attempt + 1);
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, closing MongoDB connection`);
  await mongoose.connection.close();
  process.exit(0);
};

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.once(signal, () => {
    gracefulShutdown(signal);
  });
});

