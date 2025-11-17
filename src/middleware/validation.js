import { body, validationResult } from "express-validator";

export const studentRegistration = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("profile.name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("profile.department").trim().notEmpty().withMessage("Department is required"),
  body("profile.year").isInt({ min: 1, max: 5 }).withMessage("Year must be between 1 and 5"),
  body("profile.skills").optional().isArray().withMessage("Skills must be an array of strings"),
  body("phone")
    .optional()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Phone must be a valid Indian mobile number"),
];

export const internshipCreation = [
  body("title").isLength({ min: 5, max: 200 }).withMessage("Title must be 5-200 characters"),
  body("description").isLength({ min: 50, max: 5000 }).withMessage("Description must be 50-5000 characters"),
  body("department").notEmpty().withMessage("Department is required"),
  body("requiredSkills").isArray({ min: 1, max: 20 }).withMessage("requiredSkills must be an array with 1-20 items"),
  body("duration").notEmpty().withMessage("Duration is required"),
  body("stipend").optional().isFloat({ min: 0 }).withMessage("Stipend must be positive"),
  body("startDate").isISO8601().withMessage("startDate must be a valid ISO date"),
  body("applicationDeadline")
    .isISO8601()
    .withMessage("applicationDeadline must be a valid ISO date")
    .custom((value, { req }) => {
      if (!req.body.startDate) return true;
      const deadline = new Date(value);
      const start = new Date(req.body.startDate);
      if (deadline >= start) {
        throw new Error("applicationDeadline must be before startDate");
      }
      return true;
    }),
  body("slots").isInt({ min: 1, max: 100 }).withMessage("slots must be between 1 and 100"),
];

export const logbookSubmission = [
  body("weekNumber").isInt({ min: 1 }).withMessage("weekNumber must be at least 1"),
  body("hoursWorked").isInt({ min: 1, max: 60 }).withMessage("hoursWorked must be between 1 and 60"),
  body("activities").isLength({ min: 50 }).withMessage("activities must be at least 50 characters"),
  body("skillsUsed").isArray({ min: 1 }).withMessage("skillsUsed must contain at least 1 skill"),
  body("learnings").isLength({ min: 20 }).withMessage("learnings must be at least 20 characters"),
];

export const applicationSubmit = [
  body("internshipId").notEmpty().withMessage("internshipId is required"),
  body("coverLetter").isLength({ min: 100, max: 1000 }).withMessage("coverLetter must be 100-1000 characters"),
];

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map((err) => ({
    field: err.param,
    message: err.msg,
  }));

  return res.status(400).json({
    success: false,
    error: "ValidationError",
    details: formatted,
  });
};

