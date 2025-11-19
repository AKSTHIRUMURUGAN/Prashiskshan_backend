import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import s3Client from "../config/s3.js";
import r2Client from "../config/r2.js";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";

const providers = {
  s3: {
    client: s3Client,
    bucket: config.aws.bucket,
    url: (key) => `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`,
  },
  r2: {
    client: r2Client,
    bucket: config.r2.bucket,
    url: (key) => `${config.r2.publicUrl.replace(/\/$/, "")}/${key}`,
  },
};

const putObject = async ({ client, bucket }, key, body, contentType) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await client.send(command);
};

const resolveProvider = (name = "s3") => {
  const normalized = name.toLowerCase();
  if (!providers[normalized]) {
    throw new Error(`Unsupported storage provider: ${name}`);
  }
  return { name: normalized, ...providers[normalized] };
};

export const storageService = {
  async uploadFile(buffer, { filename, contentType = "application/octet-stream", provider = "s3" } = {}) {
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${filename}`;
    const target = resolveProvider(provider);
    await putObject(target, key, buffer, contentType);
    logger.info(`Uploaded file to ${provider}`, { key });
    return { provider: target.name, key, url: target.url(key) };
  },
  async uploadToMultiple(buffer, options = {}) {
    const targets = Array.isArray(options.providers) && options.providers.length ? options.providers : Object.keys(providers);
    const results = await Promise.all(
      targets.map(async (providerName) => {
        const providerConfig = resolveProvider(providerName);
        const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${options.filename || "blob"}`;
        await putObject(providerConfig, key, buffer, options.contentType || "application/octet-stream");
        return { provider: providerConfig.name, key, url: providerConfig.url(key) };
      }),
    );
    return results;
  },
};

