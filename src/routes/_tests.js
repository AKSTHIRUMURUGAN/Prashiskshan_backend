import { Router } from "express";
import { integrationStatus } from "../controllers/testController.js";

const router = Router();

// GET /api/_tests?probe=true
router.get("/", integrationStatus);

export default router;
