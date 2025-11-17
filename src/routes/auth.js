import { Router } from "express";
import multer from "multer";
import { registerStudent, registerCompany, login, refreshProfile, updateProfile, changePassword, uploadProfileImage, uploadResume, deleteAccount } from "../controllers/authController.js";
import { studentRegistration, handleValidationErrors } from "../middleware/validation.js";
import { authenticate, identifyUser } from "../middleware/auth.js";
import { authRateLimiter, uploadRateLimiter } from "../middleware/rateLimiter.js";
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

router.get("/me", authenticate, identifyUser, asyncHandler(refreshProfile));

router.patch("/me", authenticate, identifyUser, asyncHandler(updateProfile));

router.post("/password", authenticate, authRateLimiter, asyncHandler(changePassword));

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
