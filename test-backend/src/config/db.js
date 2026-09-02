import mongoose from 'mongoose';
import { _config } from './config.js';

export default async function connectDB() {
  if (!_config.MONGO_URI) {
    throw new Error('MONGO_URI is not configured.');
  }
  await mongoose.connect(_config.MONGO_URI);
  console.log('[db] MongoDB connected');
}
