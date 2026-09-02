import jwt from 'jsonwebtoken';
import { _config } from '../config/config.js';

export function signServiceToken() {
  return jwt.sign({ service: 'test-backend' }, _config.JWT_SECRET, {
    expiresIn: '15m',
  });
}

export async function requestDamageAssessment(payload) {
  const token = signServiceToken();
  const res = await fetch(
    `${_config.DAMAGE_AI_URL}/v1/surveys/${payload.survey_id}/damage-assessments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': payload.idempotency_key,
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? `damage-ai error ${res.status}`);
  }
  return { status: res.status, data };
}
