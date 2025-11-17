import { S3Client } from "@aws-sdk/client-s3";
import config from "./index.js";

const defaultEndpoint = `https://${config.oracle.namespace}.compat.objectstorage.${config.oracle.region}.oraclecloud.com`;

const oracleClient = new S3Client({
  region: config.oracle.region,
  endpoint: config.oracle.endpoint || defaultEndpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.oracle.accessKeyId,
    secretAccessKey: config.oracle.secretAccessKey,
  },
});

export default oracleClient;

