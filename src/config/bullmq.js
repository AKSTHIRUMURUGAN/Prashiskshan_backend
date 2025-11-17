import Redis from "ioredis";
import config from "./index.js";
import { logger } from "../utils/logger.js";

const bullConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

bullConnection.on("ready", () => logger.info("BullMQ Redis ready"));
bullConnection.on("error", (error) => logger.error("BullMQ Redis error", error));

export default bullConnection;

