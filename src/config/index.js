import dotenv from "dotenv";

dotenv.config();

const requiredKeys = [
  "NODE_ENV",
  "PORT",
  "API_URL",
  "FRONTEND_URL",
  "MONGODB_URI",
  "MONGODB_TEST_URI",
  "REDIS_HOST",
  "REDIS_PORT",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL_FLASH",
  "GEMINI_MODEL_PRO",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_BUCKET",
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_WHATSAPP_NUMBER",
  "SENTRY_DSN",
  "JWT_SECRET",
  "RATE_LIMIT_WINDOW_MS",
  "RATE_LIMIT_MAX_REQUESTS",
  "AI_INTERVIEW_DAILY_LIMIT",
  "AI_CHATBOT_DAILY_LIMIT",
  "AI_SUMMARY_DAILY_LIMIT",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
];

// In test environment, be more lenient with required keys
const isTestEnv = process.env.NODE_ENV === "test";
const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length && !isTestEnv) {
  throw new Error(`Missing required environment variables: ${missingKeys.join(", ")}`);
}

const number = (value, fallback = undefined) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  app: {
    env: process.env.NODE_ENV,
    port: number(process.env.PORT, 5000),
    apiUrl: process.env.API_URL,
    frontendUrl: process.env.FRONTEND_URL,
  },
  mongo: {
    uri: process.env.MONGODB_URI,
    testUri: process.env.MONGODB_TEST_URI,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: number(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "test-project",
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : "-----BEGIN PRIVATE KEY-----\nMOCK_KEY_FOR_TESTING\n-----END PRIVATE KEY-----\n",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "test@test-project.iam.gserviceaccount.com",
    webApiKey: process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_WEB_API_KEY || undefined,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    flashModel: process.env.GEMINI_MODEL_FLASH,
    proModel: process.env.GEMINI_MODEL_PRO,
  },
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  },
  email: {
    brevo: {
      apiKey: process.env.BREVO_API_KEY,
      fromEmail: process.env.BREVO_FROM_EMAIL,
      fromName: process.env.BREVO_FROM_NAME || "Prashiskshan",
    },
    mailgun: {
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN,
      fromEmail: process.env.MAILGUN_FROM_EMAIL,
    },
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
  security: {
    jwtSecret: process.env.JWT_SECRET,
    rateLimitWindowMs: number(process.env.RATE_LIMIT_WINDOW_MS, 900000),
    rateLimitMaxRequests: number(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },
  aiLimits: {
    interviewDaily: number(process.env.AI_INTERVIEW_DAILY_LIMIT, 3),
    chatbotDaily: number(process.env.AI_CHATBOT_DAILY_LIMIT, 50),
    summaryDaily: number(process.env.AI_SUMMARY_DAILY_LIMIT, 10),
  },
  analytics: {
    // Google Analytics / Firebase Analytics Measurement Protocol (GA4)
    measurementId: process.env.FIREBASE_ANALYTICS_MEASUREMENT_ID,
    apiSecret: process.env.FIREBASE_ANALYTICS_API_SECRET,
  },
};

export default Object.freeze(config);

