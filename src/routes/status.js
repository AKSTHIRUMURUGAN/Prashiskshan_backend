import { Router } from "express";
import { status } from "../controllers/statusController.js";

const router = Router();

router.get("/", status);

export default router;
