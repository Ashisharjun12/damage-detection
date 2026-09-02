# MobileSAM ONNX models

Place these files here (or run `node scripts/download-mobile-sam.mjs`):

| File | Role |
|------|------|
| `mobile_sam_encoder.onnx` | ViT-T image encoder |
| `mobile_sam_decoder.onnx` | Mask decoder (box/point prompts) |

Optional external data blobs are not required for the Heliosoph/sam-onnx checkpoints.

Download from HuggingFace (`Heliosoph/sam-onnx` standalone checkpoints) via `scripts/download-mobile-sam.mjs`. Files are saved as:

- `mobile_sam_encoder.onnx` ← `mobile_sam_image_encoder.onnx`
- `mobile_sam_decoder.onnx` ← `sam_mask_decoder_single.onnx`

Default env paths: `SEG_ENCODER_PATH=./models/mobile_sam_encoder.onnx`, `SEG_DECODER_PATH=./models/mobile_sam_decoder.onnx`.
