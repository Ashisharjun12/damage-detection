/**
 * Unwrap webhook envelope { event, result } or return flat m02.v1 report.
 */
export function normalizeM02Report(body) {
  if (!body) return null;
  if (body.schema_version === 'm02.v1') return body;
  if (body.result?.schema_version === 'm02.v1') return body.result;
  return body;
}
