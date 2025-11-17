import { Router } from "express";
import {
  getMentorDashboard,
  getPendingApplications,
  getApplicationDetails,
  approveApplication,
  rejectApplication,
  getPendingLogbooks,
  getLogbookDetails,
  approveLogbook,
  requestLogbookRevision,
  getSkillGapAnalysis,
  getDepartmentPerformance,
  createIntervention,
  getInterventions,
  getStudentProgress,
} from "../controllers/mentorController.js";
import { authenticate, identifyUser, authorize } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const mentorAuth = [authenticate, identifyUser, authorize("mentor")];

router.get("/dashboard", mentorAuth, asyncHandler(getMentorDashboard));

router.get("/applications/pending", mentorAuth, asyncHandler(getPendingApplications));
router.get("/applications/:applicationId", mentorAuth, asyncHandler(getApplicationDetails));
router.post("/applications/:applicationId/approve", mentorAuth, asyncHandler(approveApplication));
router.post("/applications/:applicationId/reject", mentorAuth, asyncHandler(rejectApplication));

router.get("/logbooks/pending", mentorAuth, asyncHandler(getPendingLogbooks));
router.get("/logbooks/:logbookId", mentorAuth, asyncHandler(getLogbookDetails));
router.post("/logbooks/:logbookId/approve", mentorAuth, asyncHandler(approveLogbook));
router.post("/logbooks/:logbookId/revision", mentorAuth, asyncHandler(requestLogbookRevision));

router.get("/skill-gaps", mentorAuth, asyncHandler(getSkillGapAnalysis));
router.get("/department/performance", mentorAuth, asyncHandler(getDepartmentPerformance));

router.post("/interventions", mentorAuth, asyncHandler(createIntervention));
router.get("/interventions", mentorAuth, asyncHandler(getInterventions));

router.get("/students/:studentId/progress", mentorAuth, asyncHandler(getStudentProgress));

export default router;
