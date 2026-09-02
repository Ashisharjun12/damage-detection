import { Request, Response } from "express";
import { ApiError } from "@/shared/errors/api-error.js";
import { asyncHandler } from "@/shared/middleware/async-handler.js";
import { assessmentRequestSchema } from "@/infrastructure/gemini/schemas/damage-response.schema.js";
import { getAssessmentQueue } from "@/infrastructure/queue/assessment.queue.js";
import { runAssessment } from "@/pipeline/run-assessment.js";

export class AssessmentsController {
  createAssessment = asyncHandler(async (req: Request, res: Response) => {
    const parsed = assessmentRequestSchema.safeParse({
      ...req.body,
      survey_id: req.body.survey_id ?? req.params.surveyId,
    });

    if (!parsed.success) {
      throw ApiError.badRequest("Invalid request", parsed.error.issues);
    }

    const body = parsed.data;
    const queue = getAssessmentQueue();

    if (queue && body.images.length > 4) {
      const job = await queue.add("PROCESS_SURVEY", body, {
        jobId: body.idempotency_key,
        removeOnComplete: 100,
        removeOnFail: 50,
      });
      res.status(202).json({
        success: true,
        job_id: job.id,
        status: "QUEUED",
      });
      return;
    }

    const report = await runAssessment(body);
    res.status(200).json({ success: true, data: report });
  });
}
