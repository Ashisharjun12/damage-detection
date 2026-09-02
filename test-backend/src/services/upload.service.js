import { Upload } from '../models/Upload.js';
import { ApiError } from '../shared/apiError.js';
import {
  buildPublicUrl,
  buildSurveyObjectKey,
  createPresignedUploadUrl,
  deleteR2Object,
  getPresignedPutUrl,
  normalizePurpose,
  uploadObjectBuffer,
  VALID_PURPOSES,
} from './r2.storage.js';

export class UploadService {
  async uploadFileDirect(buffer, filename, contentType, purpose = 'survey', surveyId) {
    if (!buffer?.length) {
      throw ApiError.badRequest('File body is empty.');
    }
    if (!filename || !contentType) {
      throw ApiError.badRequest('filename and contentType are required.');
    }
    const normalizedPurpose = normalizePurpose(purpose);
    return uploadObjectBuffer(
      buffer,
      filename,
      contentType,
      normalizedPurpose,
      surveyId,
    );
  }

  async requestUploadUrl(filename, contentType, purpose = 'other', surveyId) {
    if (!filename || !contentType) {
      throw ApiError.badRequest('filename and contentType are required.');
    }
    const normalizedPurpose = normalizePurpose(purpose);
    return createPresignedUploadUrl(
      filename,
      contentType,
      normalizedPurpose,
      surveyId,
    );
  }

  async saveFileRecord(body) {
    const {
      url,
      publicId,
      originalName,
      mimeType,
      size,
      purpose,
      survey_id,
      image_id,
    } = body;

    if (!url || !publicId || !originalName) {
      throw ApiError.badRequest('url, publicId, and originalName are required.');
    }

    const normalizedPurpose = normalizePurpose(purpose);

    return Upload.create({
      url,
      publicId,
      originalName,
      mimeType,
      size,
      purpose: normalizedPurpose,
      survey_id,
      image_id,
    });
  }

  async listFiles(purpose, surveyId) {
    const filter = {};
    if (purpose && VALID_PURPOSES.includes(purpose)) {
      filter.purpose = purpose;
    }
    if (surveyId) {
      filter.survey_id = surveyId;
    }
    return Upload.find(filter).sort({ createdAt: -1 }).limit(100);
  }

  async getLegacyPresign(surveyId, imageId, contentType) {
    if (!surveyId || !imageId) {
      throw ApiError.badRequest('surveyId and imageId required');
    }
    const key = buildSurveyObjectKey(surveyId, imageId);
    const uploadUrl = await getPresignedPutUrl(key);
    const publicUrl = buildPublicUrl(key);
    return {
      uploadUrl,
      key,
      publicUrl,
      publicId: key,
      contentType: contentType ?? 'image/jpeg',
    };
  }

  async deleteFile(id) {
    const upload = await Upload.findById(id);
    if (!upload) return false;

    try {
      await deleteR2Object(upload.publicId);
    } catch (err) {
      console.warn('[upload] R2 delete failed:', err.message);
    }

    await upload.deleteOne();
    return true;
  }

  async deleteSurveyFiles(surveyId) {
    const uploads = await Upload.find({ survey_id: surveyId });
    for (const upload of uploads) {
      try {
        await deleteR2Object(upload.publicId);
      } catch (err) {
        console.warn('[upload] R2 delete failed:', err.message);
      }
    }
    await Upload.deleteMany({ survey_id: surveyId });
    return uploads.length;
  }
}
