import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Survey } from '../models/Survey.js';
import { requestDamageAssessment } from '../services/damage-ai.client.js';
import { UploadService } from '../services/upload.service.js';
import uploadRoutes from './upload.routes.js';
import { _config } from '../config/config.js';
import {
  getSurveyIdFromPayload,
  normalizeM02Report,
} from '../shared/normalizeM02Report.js';

const uploadService = new UploadService();

export const apiRouter = Router();

apiRouter.use('/uploads', uploadRoutes);

apiRouter.post('/surveys', async (_req, res) => {
  const survey = await Survey.create({ status: 'CREATED' });
  res.status(201).json({ success: true, data: { survey_id: survey._id.toString() } });
});

apiRouter.get('/surveys', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const surveys = await Survey.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('status images createdAt updatedAt assess_started_at report');

  res.json({
    success: true,
    data: surveys.map((s) => {
      const report = normalizeM02Report(s.report);
      const summary = report?.vehicle_damage_summary;
      return {
        survey_id: s._id.toString(),
        status: s.status,
        image_count: s.images?.length ?? 0,
        thumbnail_url: s.images?.[0]?.url ?? null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        assess_started_at: s.assess_started_at,
        overall_damage_score: report?.overall_damage_score ?? null,
        parts_affected: summary?.parts_affected ?? null,
        total_damages: summary?.total_damages ?? null,
        has_report: Boolean(report),
      };
    }),
  });
});

apiRouter.delete('/surveys/:id', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) {
    res.status(404).json({ success: false, message: 'Survey not found' });
    return;
  }

  try {
    await uploadService.deleteSurveyFiles(survey._id.toString());
  } catch (err) {
    console.warn('[survey] file cleanup failed:', err.message);
  }

  await survey.deleteOne();
  res.json({ success: true, data: { survey_id: req.params.id } });
});

apiRouter.post('/surveys/:id/images', async (req, res) => {
  const { image_id, url, declared_view, publicId, originalName, mimeType, size } = req.body;
  const survey = await Survey.findById(req.params.id);
  if (!survey) {
    res.status(404).json({ success: false, message: 'Survey not found' });
    return;
  }
  survey.images.push({ image_id, url, declared_view });
  survey.status = 'READY';
  await survey.save();

  if (publicId && originalName && url) {
    try {
      await uploadService.saveFileRecord({
        url,
        publicId,
        originalName,
        mimeType,
        size,
        purpose: 'survey',
        survey_id: survey._id.toString(),
        image_id,
      });
    } catch (err) {
      console.warn('[survey] upload record save failed:', err.message);
    }
  }

  res.json({ success: true, data: survey });
});

apiRouter.post('/surveys/:id/assess', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) {
    res.status(404).json({ success: false, message: 'Survey not found' });
    return;
  }
  if (!survey.images.length) {
    res.status(400).json({ success: false, message: 'No images on survey' });
    return;
  }

  survey.assess_started_at = new Date();
  survey.assess_error = undefined;
  await survey.save();

  const payload = {
    request_id: randomUUID(),
    survey_id: survey._id.toString(),
    idempotency_key: `survey_${survey._id}_${Date.now()}`,
    images: survey.images.map((img) => ({
      image_id: img.image_id,
      url: img.url,
      ...(img.declared_view ? { declared_view: img.declared_view } : {}),
    })),
  };

  try {
    const result = await requestDamageAssessment(payload);

    if (result.status === 202) {
      survey.status = 'QUEUED';
      survey.job_id = result.data.job_id;
      await survey.save();
      res.status(202).json({
        success: true,
        data: { job_id: result.data.job_id, status: 'QUEUED' },
      });
      return;
    }

    survey.report = result.data.data;
    survey.status = result.data.data?.status ?? 'COMPLETED';
    await survey.save();
    res.json({ success: true, data: result.data.data });
  } catch (err) {
    survey.status = 'FAILED';
    survey.assess_error = err instanceof Error ? err.message : String(err);
    await survey.save();
    res.status(500).json({
      success: false,
      message: survey.assess_error,
    });
  }
});

apiRouter.get('/surveys/:id', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) {
    res.status(404).json({ success: false, message: 'Survey not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      survey_id: survey._id.toString(),
      status: survey.status,
      images: survey.images,
      report: normalizeM02Report(survey.report),
      job_id: survey.job_id,
      assess_started_at: survey.assess_started_at,
      assess_error: survey.assess_error,
      createdAt: survey.createdAt,
      updatedAt: survey.updatedAt,
    },
  });
});

export const webhookRouter = Router();

webhookRouter.post('/webhook', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== _config.WEBHOOK_SECRET) {
    res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    return;
  }

  const surveyId = getSurveyIdFromPayload(req.body);
  if (!surveyId) {
    res.status(400).json({ success: false, message: 'Invalid report' });
    return;
  }

  const report = normalizeM02Report(req.body);
  if (!report?.survey_id) {
    res.status(400).json({ success: false, message: 'Invalid report' });
    return;
  }

  const survey = await Survey.findById(surveyId);
  if (!survey) {
    res.status(404).json({ success: false, message: 'Survey not found' });
    return;
  }

  survey.report = report;
  survey.status = report.status ?? req.body.status ?? 'COMPLETED';
  survey.assess_error = undefined;
  await survey.save();

  res.json({ success: true });
});
