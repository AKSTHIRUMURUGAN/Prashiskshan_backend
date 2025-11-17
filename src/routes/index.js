import { Router } from "express";
import authRouter from "./auth.js";
import studentRouter from "./student.js";
import mentorRouter from "./mentor.js";
import companyRouter from "./company.js";
import adminRouter from "./admin.js";
import { apiSuccess, apiError } from "../utils/apiResponse.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json(apiSuccess({ uptime: process.uptime() }, "Prashiskshan API is healthy"));
});

router.use("/auth", authRouter);
router.use("/students", studentRouter);
router.use("/mentors", mentorRouter);
router.use("/companies", companyRouter);
router.use("/admins", adminRouter);

router.use((req, res) => {
  res.status(404).json(apiError("Route not found", { path: req.originalUrl }, { status: 404 }));
});

export default router;
