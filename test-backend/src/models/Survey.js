import mongoose from 'mongoose';

const surveyImageSchema = new mongoose.Schema({
  image_id: { type: String, required: true },
  url: { type: String, required: true },
  declared_view: { type: String },
});

const surveySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['CREATED', 'UPLOADING', 'READY', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'REVIEW_REQUIRED'],
      default: 'CREATED',
    },
    images: [surveyImageSchema],
    report: { type: mongoose.Schema.Types.Mixed },
    job_id: { type: String },
    assess_started_at: { type: Date },
    assess_error: { type: String },
  },
  { timestamps: true },
);

export const Survey = mongoose.model('Survey', surveySchema);
