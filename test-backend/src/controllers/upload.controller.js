import { asyncHandler } from '../shared/asyncHandler.js';
import { ApiResponse } from '../shared/apiResponse.js';
import { ApiError } from '../shared/apiError.js';
import { UploadService } from '../services/upload.service.js';

const uploadService = new UploadService();

export class UploadController {
  uploadDirect = asyncHandler(async (req, res) => {
    const filename = req.headers['x-filename'];
    const contentType = req.headers['content-type'];
    const purpose = req.headers['x-purpose'];
    const surveyId = req.headers['x-survey-id'];

    const result = await uploadService.uploadFileDirect(
      req.body,
      filename,
      contentType,
      purpose,
      surveyId,
    );

    res
      .status(201)
      .json(new ApiResponse(201, result, 'File uploaded successfully.'));
  });

  requestUploadUrl = asyncHandler(async (req, res) => {
    const { filename, contentType, purpose, survey_id } = req.body;
    const result = await uploadService.requestUploadUrl(
      filename,
      contentType,
      purpose,
      survey_id,
    );
    res
      .status(200)
      .json(new ApiResponse(200, result, 'Upload URL generated successfully.'));
  });

  saveFileRecord = asyncHandler(async (req, res) => {
    const upload = await uploadService.saveFileRecord(req.body);
    res
      .status(201)
      .json(new ApiResponse(201, upload, 'File record saved successfully.'));
  });

  listFiles = asyncHandler(async (req, res) => {
    const files = await uploadService.listFiles(
      req.query.purpose,
      req.query.survey_id,
    );
    res
      .status(200)
      .json(new ApiResponse(200, files, 'Files fetched successfully.'));
  });

  presign = asyncHandler(async (req, res) => {
    const { surveyId, imageId, contentType } = req.query;
    const result = await uploadService.getLegacyPresign(
      surveyId,
      imageId,
      contentType,
    );
    res.status(200).json(new ApiResponse(200, result, 'Presign URL generated.'));
  });

  deleteFile = asyncHandler(async (req, res) => {
    const success = await uploadService.deleteFile(req.params.id);
    if (!success) {
      throw ApiError.notFound('File record not found.');
    }
    res
      .status(200)
      .json(new ApiResponse(200, null, 'File deleted successfully.'));
  });
}
