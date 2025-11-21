import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import config from "./index.js";
import { logger } from "../utils/logger.js";

const isTestEnv = process.env.NODE_ENV === "test";
// Allow forcing the use of real Firebase even when emulator env is present
const forceRealFirebase = process.env.FIREBASE_FORCE_REAL === "true" || process.env.FIREBASE_FORCE_REAL === "1";

if (!admin.apps.length) {
  try {
    // If an Auth emulator host is provided, prefer using the emulator (works in dev and test)
    // You can override this behaviour by setting `FIREBASE_FORCE_REAL=true` in the environment.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST && !forceRealFirebase) {
      // Use Firebase Auth Emulator
      admin.initializeApp({ projectId: config.firebase.projectId });
      logger.info("Firebase Admin initialized with Auth emulator", { host: process.env.FIREBASE_AUTH_EMULATOR_HOST });
    } else {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST && forceRealFirebase) {
        logger.info("FIREBASE_FORCE_REAL=true: ignoring FIREBASE_AUTH_EMULATOR_HOST and initializing real Firebase");
      }
      // If GOOGLE_APPLICATION_CREDENTIALS not set, look for a local firebase.json service account in project root
      const saPath = path.resolve(process.cwd(), "firebase.json");
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(saPath)) {
        try {
          const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
          admin.initializeApp({ credential: admin.credential.cert(sa) });
          logger.info("Firebase Admin initialized using local firebase.json service account");
        } catch (err) {
          logger.warn("Failed to initialize Firebase from firebase.json", { error: err.message });
        }
      }
      // Check if we have valid credentials (env-configured)
      const hasValidCredentials =
        config.firebase.projectId &&
        config.firebase.privateKey &&
        config.firebase.privateKey !== "-----BEGIN PRIVATE KEY-----\nMOCK_KEY_FOR_TESTING\n-----END PRIVATE KEY-----\n" &&
        config.firebase.clientEmail;

      if (!admin.apps.length && hasValidCredentials) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.firebase.projectId,
            privateKey: config.firebase.privateKey,
            clientEmail: config.firebase.clientEmail,
          }),
        });
        logger.info("Firebase Admin initialized using environment credentials");
      } else if (isTestEnv) {
        // In test mode, initialize with minimal config (will fail on actual API calls but allows initialization)
        try {
          admin.initializeApp({ projectId: config.firebase.projectId });
          logger.warn("Firebase Admin initialized in test mode without credentials");
        } catch (testError) {
          logger.warn("Firebase Admin initialization skipped in test mode:", testError.message);
        }
      } else {
        if (!admin.apps.length) {
          throw new Error("Firebase credentials are required in non-test environment");
        }
      }
    }
  } catch (error) {
    if (isTestEnv) {
      logger.warn("Firebase initialization failed in test mode:", error.message);
      // Don't throw in test mode, allow tests to continue
    } else {
      logger.error("Firebase initialization failed", error);
      throw error;
    }
  }
}

export const firebaseAdmin = admin;

export const verifyToken = async (idToken) => {
  try {
    // Quick sanity check: Firebase ID tokens are JWTs and contain two dots (three segments).
    if (!idToken || typeof idToken !== "string" || (idToken.match(/\./g) || []).length < 2) {
      throw new Error(
        "Invalid ID token format: expected a Firebase ID token (JWT). Obtain an ID token from the client (e.g. `currentUser.getIdToken()` or the `idToken` field returned by the Identity Toolkit REST sign-in). If you have a custom token, exchange it for an ID token on the client via `signInWithCustomToken()` before calling this API."
      );
    }
    // In test mode, handle mock tokens
    if (isTestEnv && idToken && typeof idToken === "string" && idToken.startsWith("mock-custom-token-")) {
      const uid = idToken.replace("mock-custom-token-", "");
      // Try to look up user in database to get email
      try {
        const mongoose = (await import("mongoose")).default;
        const Student = (await import("../models/Student.js")).default;
        const Mentor = (await import("../models/Mentor.js")).default;
        const Admin = (await import("../models/Admin.js")).default;
        const Company = (await import("../models/Company.js")).default;

        const [student, mentor, admin, company] = await Promise.all([
          Student.findOne({ firebaseUid: uid }),
          Mentor.findOne({ firebaseUid: uid }),
          Admin.findOne({ firebaseUid: uid }),
          Company.findOne({ firebaseUid: uid }),
        ]);

        const user = student || mentor || admin || company;
        if (user) {
          return {
            uid,
            email: user.email || `test-${uid}@test.com`,
            email_verified: true,
          };
        }
      } catch (dbError) {
        // If DB lookup fails, return mock data
        logger.warn("Could not lookup user in test mode:", dbError.message);
      }
      // Fallback: return mock data with UID
      return {
        uid,
        email: `test-${uid}@test.com`,
        email_verified: true,
      };
    }
    return await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    // In test mode, if token verification fails and it looks like a mock token, handle it
    if (isTestEnv && idToken && typeof idToken === "string" && idToken.includes("mock")) {
      logger.warn("Using mock token in test mode after verification failure:", idToken);
      const uid = idToken.replace("mock-custom-token-", "").split("-")[0] || "mock-uid";
      return {
        uid,
        email: `test-${uid}@test.com`,
        email_verified: true,
      };
    }
    logger.error("Firebase token verification failed", error);
    throw error;
  }
};

