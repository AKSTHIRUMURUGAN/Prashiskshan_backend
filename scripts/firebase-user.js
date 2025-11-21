import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    // Initialize Firebase Admin safely:
    // - If GOOGLE_APPLICATION_CREDENTIALS / ADC is configured, let the SDK use it.
    // - Otherwise, if a local `firebase.json` service account exists, use it.
    // - If neither is available, print actionable guidance instead of calling initializeApp() with no creds.
    if (!admin.apps.length) {
      const saPath = path.resolve(process.cwd(), 'firebase.json');
      const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (hasADC) {
        // Let admin SDK pick up ADC from the environment
        admin.initializeApp();
      } else if (fs.existsSync(saPath)) {
        try {
          const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
          admin.initializeApp({ credential: admin.credential.cert(sa) });
          console.log('Initialized Firebase Admin from firebase.json');
        } catch (readErr) {
          console.error('Failed reading firebase.json:', readErr.message);
          throw readErr;
        }
      } else {
        throw new Error(
          'No Firebase credentials found. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path, or place a service-account JSON at ./firebase.json'
        );
      }
    }

    const user = await admin.auth().createUser({ email: 'test+manual@yourdomain.com', password: 'Test1234!' });
    console.log('Created user', user.uid);
  } catch (err) {
    console.error('Create user failed', err);
  }
})();