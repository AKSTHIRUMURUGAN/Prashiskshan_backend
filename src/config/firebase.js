import admin from "firebase-admin";
import config from "./index.js";
import { logger } from "../utils/logger.js";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    });
    logger.info("Firebase Admin initialized");
  } catch (error) {
    logger.error("Firebase initialization failed", error);
    throw error;
  }
}

export const firebaseAdmin = admin;

export const verifyToken = async (idToken) => {
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    logger.error("Firebase token verification failed", error);
    throw error;
  }
};

