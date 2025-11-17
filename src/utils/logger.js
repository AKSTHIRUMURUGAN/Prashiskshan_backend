import fs from "node:fs";
import path from "node:path";
import winston from "winston";
import config from "../config/index.js";

const { combine, timestamp, errors, json, splat, colorize, printf } = winston.format;

const LOG_LEVEL = config.app.env === "production" ? "info" : "debug";
const LOG_DIR = path.join(process.cwd(), "logs");

const ensureLogDirectory = () => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error("Unable to create logs directory", error); // eslint-disable-line no-console
  }
};

ensureLogDirectory();

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaString = Object.keys(meta || {}).length ? ` ${JSON.stringify(meta)}` : "";
  const logMessage = stack || message;
  return `${ts} [${level}] ${logMessage}${metaString}`;
});

const transports = [
  new winston.transports.Console({
    level: LOG_LEVEL,
    handleExceptions: true,
    format: combine(colorize(), timestamp(), splat(), consoleFormat),
  }),
];

if (config.app.env === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
      level: LOG_LEVEL,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: combine(timestamp(), errors({ stack: true }), splat(), json()),
  transports,
  exitOnError: false,
});

export const createChildLogger = (defaultMeta = {}) => logger.child(defaultMeta);

export const logRequestError = (error, req) => {
  logger.error(error, {
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user: req.user?.firebaseUid || "anonymous",
    },
  });
};
