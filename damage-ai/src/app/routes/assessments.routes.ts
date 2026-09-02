import { Router } from "express";
import { requireJwt } from "@/app/middleware/jwt.middleware.js";
import { AssessmentsController } from "@/app/controllers/assessments.controller.js";

export const assessmentsRouter = Router();
const controller = new AssessmentsController();

assessmentsRouter.post(
  "/surveys/:surveyId/damage-assessments",
  requireJwt,
  controller.createAssessment,
);
