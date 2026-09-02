import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurveyIdFromPayload,
  normalizeM02Report,
} from './normalizeM02Report.js';

describe('normalizeM02Report', () => {
  const flat = {
    schema_version: 'm02.v1',
    survey_id: 'abc',
    overall_damage_score: 44,
    images: [{ image_id: 'img1' }],
  };

  const wrapped = {
    event: 'm02.damage_analysis.completed',
    survey_id: 'abc',
    status: 'REVIEW_REQUIRED',
    result: flat,
  };

  it('returns flat m02.v1 report unchanged', () => {
    assert.equal(normalizeM02Report(flat), flat);
  });

  it('unwraps webhook envelope', () => {
    assert.equal(normalizeM02Report(wrapped), flat);
    assert.equal(normalizeM02Report(wrapped).overall_damage_score, 44);
  });

  it('getSurveyIdFromPayload reads wrapped survey_id', () => {
    assert.equal(getSurveyIdFromPayload(wrapped), 'abc');
    assert.equal(getSurveyIdFromPayload(flat), 'abc');
  });
});
