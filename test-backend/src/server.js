import express from 'express';
import { _config } from './config/config.js';
import connectDB from './config/db.js';
import { UploadController } from './controllers/upload.controller.js';
import { apiRouter, webhookRouter } from './routes/index.js';
import { errorHandler } from './shared/errorHandler.js';

const app = express();
const uploadController = new UploadController();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = _config.CORS_ORIGIN;
  if (origin && (origin === allowed || _config.NODE_ENV === 'development')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', allowed);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Filename, X-Purpose, X-Survey-Id',
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.post(
  '/api/uploads/direct',
  express.raw({ type: '*/*', limit: '25mb' }),
  uploadController.uploadDirect,
);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ message: 'Server is running', service: 'test-backend' });
});

app.use('/api', apiRouter);
app.use('/', webhookRouter);
app.use(errorHandler);

await connectDB();

app.listen(_config.PORT, () => {
  console.log(`Server is running on port ${_config.PORT}`);
});
