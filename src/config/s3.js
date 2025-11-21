import { S3Client, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import config from "./index.js";
import { logger } from "../utils/logger.js";

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

// Check bucket location at startup and warn if it doesn't match configured region.
// This helps diagnose errors like: "The bucket you are attempting to access must be addressed using the specified endpoint.".
const checkBucketRegion = async () => {
  try {
    if (!config.aws.bucket) return;
    const cmd = new GetBucketLocationCommand({ Bucket: config.aws.bucket });
    const resp = await s3Client.send(cmd);
    // LocationConstraint can be null (for us-east-1) or a region string.
    const bucketRegion = resp.LocationConstraint || "us-east-1";
    if (bucketRegion !== config.aws.region) {
      logger.warn("S3 bucket region mismatch", { bucket: config.aws.bucket, bucketRegion, configuredRegion: config.aws.region });
    } else {
      logger.info("S3 bucket region matches configured region", { bucket: config.aws.bucket, region: bucketRegion });
    }
  } catch (err) {
    logger.warn("S3 bucket region check failed", { error: err.message });
  }
};

// Fire-and-forget the region check so it doesn't block startup.
checkBucketRegion().catch(() => {});

export default s3Client;

