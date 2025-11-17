export const ROLES = Object.freeze({
  STUDENT: "student",
  MENTOR: "mentor",
  ADMIN: "admin",
  COMPANY: "company",
});

export const USER_ROLES = ROLES;

export const COMPANY_STATUSES = Object.freeze({
  PENDING: "pending_verification",
  VERIFIED: "verified",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
});

export const INTERNSHIP_STATUSES = Object.freeze({
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  CLOSED: "closed",
  CANCELLED: "cancelled",
});

export const APPLICATION_STATUSES = Object.freeze({
  PENDING: "pending",
  MENTOR_APPROVED: "mentor_approved",
  MENTOR_REJECTED: "mentor_rejected",
  SHORTLISTED: "shortlisted",
  REJECTED: "rejected",
  ACCEPTED: "accepted",
  WITHDRAWN: "withdrawn",
});

export const LOGBOOK_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  PENDING_MENTOR_REVIEW: "pending_mentor_review",
  PENDING_COMPANY_REVIEW: "pending_company_review",
  APPROVED: "approved",
  NEEDS_REVISION: "needs_revision",
  COMPLETED: "completed",
});

export const NOTIFICATION_PRIORITIES = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

export const HOURS_PER_CREDIT = 30;
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const CACHE_TTLS = Object.freeze({
  SHORT: 60,
  MEDIUM: 60 * 10,
  LONG: 60 * 60,
  XLONG: 60 * 60 * 24,
});

export const AI_FEATURES = Object.freeze({
  INTERVIEW: "ai_interview",
  CHATBOT: "ai_chatbot",
  SUMMARY: "logbook_summary",
  COMPANY_VERIFICATION: "company_verification",
  SKILL_GAP: "skill_gap_analysis",
});
