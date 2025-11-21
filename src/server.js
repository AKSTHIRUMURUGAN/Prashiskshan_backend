import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import config from "./config/index.js";
import { connectDB } from "./config/database.js";
import apiRouter from "./routes/index.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalRateLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./utils/logger.js";
import { registerBullBoard } from "./queues/index.js";
import swaggerUi from "swagger-ui-express";
import openapiSpec from "./docs/openapi.js";

const app = express();
app.set("trust proxy", 1);

const corsOptions = {
  origin: config.app.frontendUrl,
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Prashiskshan API" });
});

// Swagger UI (OpenAPI) - mount before the main API router so /api/docs isn't captured by API 404
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api/docs.json", (_req, res) => res.json(openapiSpec));

app.use("/api", generalRateLimiter, apiRouter);

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    await registerBullBoard(app, { basePath: "/admin/queues" });
    const port = config.app.port || 5000;
    app.listen(port, () => {
      logger.info(`Prashiskshan API listening on port ${port}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  }
};

startServer();

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message });
  process.exit(1);
});
