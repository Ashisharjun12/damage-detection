import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    purpose: {
      type: String,
      enum: ['survey', 'annotated', 'other'],
      default: 'other',
    },
    survey_id: { type: String },
    image_id: { type: String },
  },
  { timestamps: true },
);

export const Upload = mongoose.model('Upload', uploadSchema);
