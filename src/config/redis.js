import Redis from "ioredis";
import config from "./index.js";
import { logger } from "../utils/logger.js";

const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 200, 1000);
  },
});

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("error", (error) => logger.error("Redis error", error));

export const get = async (key) => redisClient.get(key);
export const set = async (key, value, expirationInSeconds) => {
  if (expirationInSeconds) {
    await redisClient.set(key, value, "EX", expirationInSeconds);
    return;
  }
  await redisClient.set(key, value);
};
export const setex = async (key, seconds, value) => redisClient.setex(key, seconds, value);
export const del = async (key) => redisClient.del(key);
export const exists = async (key) => redisClient.exists(key);
export const hset = async (key, field, value) => redisClient.hset(key, field, value);
export const hget = async (key, field) => redisClient.hget(key, field);
export const hincrby = async (key, field, increment) => redisClient.hincrby(key, field, increment);

export default redisClient;

