import { Router } from "express";
import {
  getAdminDashboard,
  getPendingCompanies,
  getCompanyDetails,
  verifyCompany,
  rejectCompany,
  suspendCompany,
  bulkImportStudents,
  getImportJobStatus,
  assignMentor,
  processCredits,
  generateSystemReport,
  getAdminAnalytics,
  getCollegeAnalytics,
  getSystemHealth,
  getAIUsageStats,
} from "../controllers/adminController.js";
import { authenticate, identifyUser, authorize } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const adminAuth = [authenticate, identifyUser, authorize("admin")];

router.get("/dashboard", adminAuth, asyncHandler(getAdminDashboard));
router.get("/companies/pending", adminAuth, asyncHandler(getPendingCompanies));
router.get("/companies/:companyId", adminAuth, asyncHandler(getCompanyDetails));
router.post("/companies/:companyId/verify", adminAuth, asyncHandler(verifyCompany));
router.post("/companies/:companyId/reject", adminAuth, asyncHandler(rejectCompany));
router.post("/companies/:companyId/suspend", adminAuth, asyncHandler(suspendCompany));

router.post("/students/import", adminAuth, asyncHandler(bulkImportStudents));
router.get("/students/import/:jobId", adminAuth, asyncHandler(getImportJobStatus));
router.post("/mentors/assign", adminAuth, asyncHandler(assignMentor));

router.post("/credits/process", adminAuth, asyncHandler(processCredits));
router.post("/reports/system", adminAuth, asyncHandler(generateSystemReport));

router.get("/analytics/system", adminAuth, asyncHandler(getAdminAnalytics));
router.get("/analytics/college", adminAuth, asyncHandler(getCollegeAnalytics));
router.get("/system/health", adminAuth, asyncHandler(getSystemHealth));
router.get("/ai/usage", adminAuth, asyncHandler(getAIUsageStats));

export default router;
