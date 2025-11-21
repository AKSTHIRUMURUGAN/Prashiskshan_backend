# Prashiskshan Backend

This repository contains an Express.js backend scaffold for the Prashiskshan internship management platform. The current version includes placeholder modules so we can progressively flesh out each feature area.

## Getting Started

```
npm install
npm run dev
```

The above commands install dependencies and start the development server with hot reload.

## Project Layout

The `src` directory mirrors the target architecture documented in the specification. Each file currently exports a minimal placeholder implementation that will be expanded in subsequent phases.

## Firebase (emulator vs real project)

Development can use the Firebase Auth emulator or a real Firebase project. The project will prefer the emulator when `FIREBASE_AUTH_EMULATOR_HOST` is set. To force the server to use your real Firebase project instead:

- Set the Google service account credentials (recommended) by downloading the JSON from the Firebase console and setting `GOOGLE_APPLICATION_CREDENTIALS` to its path, or export the individual `config.firebase.*` environment variables used by the project.
- If `FIREBASE_AUTH_EMULATOR_HOST` is present but you still want to use the real Firebase, set `FIREBASE_FORCE_REAL=true` in your environment. This will ignore the emulator host and initialize the Admin SDK with your service account.

Verify the active Firebase mode at runtime using the diagnostic endpoint `/api/_status` (see OpenAPI docs at `/api/docs`).

