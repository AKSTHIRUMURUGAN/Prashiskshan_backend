import { Router } from "express";
import {
  getCompanyDashboard,
  getCompanyProfile,
  updateCompanyProfile,
  createInternship,
  updateInternship,
  deleteInternship,
  getCompanyInternships,
  getApplicants,
  reviewApplications,
  shortlistCandidates,
  rejectCandidates,
  getInternsProgress,
  provideLogbookFeedback,
  markInternshipComplete,
  createEvent,
  createChallenge,
} from "../controllers/companyController.js";
import { authenticate, identifyUser, authorize } from "../middleware/auth.js";
import { internshipCreation, handleValidationErrors } from "../middleware/validation.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const companyAuth = [authenticate, identifyUser, authorize("company")];

router.get("/dashboard", companyAuth, asyncHandler(getCompanyDashboard));

router.get("/profile", companyAuth, asyncHandler(getCompanyProfile));
router.patch("/profile", companyAuth, asyncHandler(updateCompanyProfile));

router.post(
  "/internships",
  companyAuth,
  internshipCreation,
  handleValidationErrors,
  asyncHandler(createInternship),
);
router.get("/internships", companyAuth, asyncHandler(getCompanyInternships));
router.put("/internships/:internshipId", companyAuth, asyncHandler(updateInternship));
router.delete("/internships/:internshipId", companyAuth, asyncHandler(deleteInternship));
router.post("/internships/:internshipId/complete", companyAuth, asyncHandler(markInternshipComplete));

router.get("/internships/:internshipId/applicants", companyAuth, asyncHandler(getApplicants));
router.post("/applications/review", companyAuth, asyncHandler(reviewApplications));
router.post("/applications/shortlist", companyAuth, asyncHandler(shortlistCandidates));
router.post("/applications/reject", companyAuth, asyncHandler(rejectCandidates));

router.get("/interns/progress", companyAuth, asyncHandler(getInternsProgress));
router.post("/logbooks/:logbookId/feedback", companyAuth, asyncHandler(provideLogbookFeedback));

router.post("/events", companyAuth, asyncHandler(createEvent));
router.post("/challenges", companyAuth, asyncHandler(createChallenge));

export default router;
