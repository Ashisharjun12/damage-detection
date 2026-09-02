const API_URL = import.meta.env.VITE_API_URL ?? '';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'REVIEW_REQUIRED', 'FAILED']);

async function request(path, options = {}) {
  try {
    const res = await fetch(`${API_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `Request failed: ${res.status}`);
    }
    return data;
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error(
        'Cannot reach the API. Start test-backend (pnpm dev:backend) on port 3002, or set VITE_API_URL.',
      );
    }
    throw err;
  }
}

export async function createSurvey() {
  return request('/api/surveys', { method: 'POST' });
}

export async function getPresign(surveyId, imageId, contentType = 'image/jpeg') {
  const params = new URLSearchParams({
    surveyId,
    imageId,
    contentType,
  });
  return request(`/api/uploads/presign?${params}`);
}

export async function requestUploadUrl(
  filename,
  contentType,
  purpose = 'survey',
  surveyId,
) {
  return request('/api/uploads/request-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename,
      contentType,
      purpose,
      survey_id: surveyId,
    }),
  });
}

/** Upload file through test-backend (avoids browser → R2 CORS issues). */
export async function uploadFileDirect(surveyId, file) {
  return request('/api/uploads/direct', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'image/jpeg',
      'X-Survey-Id': surveyId,
      'X-Filename': file.name,
      'X-Purpose': 'survey',
    },
    body: file,
  });
}

export async function saveUploadRecord(record) {
  return request('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
}

export async function listUploads({ purpose, surveyId } = {}) {
  const params = new URLSearchParams();
  if (purpose) params.set('purpose', purpose);
  if (surveyId) params.set('survey_id', surveyId);
  const qs = params.toString();
  return request(`/api/uploads${qs ? `?${qs}` : ''}`);
}

export async function uploadToR2(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'image/jpeg' },
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status}`);
  }
}

export async function registerImage(surveyId, imageId, url, declaredView, meta = {}) {
  const body = { image_id: imageId, url, ...meta };
  if (declaredView) {
    body.declared_view = declaredView;
  }
  return request(`/api/surveys/${surveyId}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function assessSurvey(surveyId) {
  return request(`/api/surveys/${surveyId}/assess`, { method: 'POST' });
}

export async function getSurvey(surveyId) {
  return request(`/api/surveys/${surveyId}`);
}

export async function listSurveys(limit = 20) {
  return request(`/api/surveys?limit=${limit}`);
}

export async function deleteSurvey(surveyId) {
  return request(`/api/surveys/${surveyId}`, { method: 'DELETE' });
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

export async function pollSurvey(surveyId, { intervalMs = 2000, maxAttempts = 90 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getSurvey(surveyId);
    const status = result.data?.status;
    if (isTerminalStatus(status)) {
      return result;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Polling timed out');
}
