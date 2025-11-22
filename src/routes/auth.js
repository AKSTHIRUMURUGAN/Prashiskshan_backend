import { Router } from "express";
import multer from "multer";
import { registerStudent, registerCompany, login, refreshProfile, updateProfile, changePassword, uploadProfileImage, uploadResume, deleteAccount, exchangeCookieToken, sendVerificationEmail, sendPasswordResetEmail } from "../controllers/authController.js";
import { studentRegistration, handleValidationErrors } from "../middleware/validation.js";
import { authenticate, identifyUser } from "../middleware/auth.js";
import { authRateLimiterMiddleware as authRateLimiter, uploadRateLimiter } from "../middleware/rateLimiter.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post(
  "/students/register",
  studentRegistration,
  handleValidationErrors,
  asyncHandler(registerStudent),
);

router.post("/companies/register", asyncHandler(registerCompany));

router.post("/login", authRateLimiter, asyncHandler(login));

// Exchange server-issued custom token cookie (`auth_token`) for an ID token and set `id_token` cookie
router.post("/exchange-cookie", asyncHandler(exchangeCookieToken));

router.get("/me", authenticate, identifyUser, asyncHandler(refreshProfile));

router.patch("/me", authenticate, identifyUser, asyncHandler(updateProfile));

router.post("/password", authenticate, authRateLimiter, asyncHandler(changePassword));

// Send email verification to currently authenticated user
router.post("/send-verification", authenticate, identifyUser, asyncHandler(sendVerificationEmail));

// Request password reset email (public)
router.post("/send-password-reset", authRateLimiter, asyncHandler(sendPasswordResetEmail));

router.post(
  "/profile/image",
  authenticate,
  identifyUser,
  uploadRateLimiter,
  imageUpload.single("file"),
  asyncHandler(uploadProfileImage),
);

router.post(
  "/profile/resume",
  authenticate,
  identifyUser,
  uploadRateLimiter,
  documentUpload.single("file"),
  asyncHandler(uploadResume),
);

router.delete("/account", authenticate, identifyUser, asyncHandler(deleteAccount));

export default router;
