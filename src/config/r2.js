import { S3Client } from "@aws-sdk/client-s3";
import config from "./index.js";

const endpoint = `https://${config.r2.accountId}.r2.cloudflarestorage.com`;

const r2Client = new S3Client({
  region: "auto",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export default r2Client;

