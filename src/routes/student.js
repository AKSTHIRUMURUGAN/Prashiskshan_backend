import { Router } from "express";
import {
  getStudentDashboard,
  browseInternships,
  getRecommendedInternships,
  applyToInternship,
  getMyApplications,
  withdrawApplication,
  getRecommendedModules,
  startModule,
  completeModule,
  startInterviewPractice,
  submitInterviewAnswer,
  endInterview,
  getInterviewHistory,
  submitLogbook,
  getMyLogbooks,
  getCreditsSummary,
  generateNEPReport,
  chatbotQuery,
} from "../controllers/studentController.js";
import { authenticate, identifyUser, authorize } from "../middleware/auth.js";
import { aiFeatureLimit } from "../middleware/rateLimiter.js";
import { applicationSubmit, logbookSubmission, handleValidationErrors } from "../middleware/validation.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const studentAuth = [authenticate, identifyUser, authorize("student")];

router.get("/dashboard", studentAuth, asyncHandler(getStudentDashboard));

router.get("/internships", studentAuth, asyncHandler(browseInternships));
router.get("/internships/recommended", studentAuth, asyncHandler(getRecommendedInternships));

router.post(
  "/applications",
  studentAuth,
  applicationSubmit,
  handleValidationErrors,
  asyncHandler(applyToInternship),
);
router.get("/applications", studentAuth, asyncHandler(getMyApplications));
router.delete("/applications/:applicationId", studentAuth, asyncHandler(withdrawApplication));

router.get("/modules/recommended", studentAuth, asyncHandler(getRecommendedModules));
router.post("/modules/start", studentAuth, asyncHandler(startModule));
router.post("/modules/complete", studentAuth, asyncHandler(completeModule));

router.post("/interviews/start", studentAuth, aiFeatureLimit("interview"), asyncHandler(startInterviewPractice));
router.post("/interviews/answer", studentAuth, aiFeatureLimit("interview"), asyncHandler(submitInterviewAnswer));
router.post("/interviews/end", studentAuth, asyncHandler(endInterview));
router.get("/interviews/history", studentAuth, asyncHandler(getInterviewHistory));

router.post(
  "/logbooks",
  studentAuth,
  logbookSubmission,
  handleValidationErrors,
  asyncHandler(submitLogbook),
);
router.get("/logbooks", studentAuth, asyncHandler(getMyLogbooks));

router.get("/credits", studentAuth, asyncHandler(getCreditsSummary));
router.post("/reports/nep", studentAuth, asyncHandler(generateNEPReport));
router.post("/chatbot", studentAuth, aiFeatureLimit("chatbot"), asyncHandler(chatbotQuery));

export default router;
