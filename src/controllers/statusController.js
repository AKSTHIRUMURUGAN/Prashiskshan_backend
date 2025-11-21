import fs from "fs";
import path from "path";

export const status = (req, res) => {
  const usingEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const adc = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const hasEnvCreds = Boolean(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID);
  const saPath = path.resolve(process.cwd(), "firebase.json");
  const hasLocalServiceAccount = fs.existsSync(saPath);

  return res.json({
    success: true,
    firebase: {
      usingEmulator,
      credentialSource: adc ? "GOOGLE_APPLICATION_CREDENTIALS" : hasLocalServiceAccount ? "firebase.json" : hasEnvCreds ? "env" : "none",
      paths: {
        firebaseJson: hasLocalServiceAccount ? saPath : null,
        googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
      },
    },
  });
};

export default { status };
