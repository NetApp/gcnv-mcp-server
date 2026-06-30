import { describe, expect, it } from 'vitest';
import {
  errorResponse,
  formatOntapError,
  sanitizeStructuredContent,
  successResponse,
  wrapAsyncJobResponse,
} from './ontap-response-utils.js';

describe('ontap-response-utils', () => {
  it('detects async job uuid and includes polling guidance', () => {
    const wrapped = wrapAsyncJobResponse({ job: { uuid: 'job-123' } });
    expect(wrapped.asyncJobDetected).toBe(true);
    expect(wrapped.pollingGuidance).toContain('job-123');
  });

  it('does not mark async when job uuid missing', () => {
    const wrapped = wrapAsyncJobResponse({ job: {} });
    expect(wrapped.asyncJobDetected).toBeUndefined();
  });

  it('formats ONTAP error from JSON body', () => {
    const formatted = formatOntapError(
      400,
      JSON.stringify({
        error: { code: 262179, message: 'Unexpected argument', target: 'type.name' },
      }),
      '/api/foo'
    );
    expect(formatted).toEqual({
      code: '262179',
      message: 'Unexpected argument',
      target: 'type.name',
      suggestion: 'Review the error message and adjust the request parameters.',
    });
  });

  it('formats ONTAP error from rawResponse.error body and missing message fallback', () => {
    const formatted = formatOntapError(
      502,
      JSON.stringify({ rawResponse: { error: { code: 777, target: '/api/raw' } } }),
      '/api/fallback'
    );
    expect(formatted.code).toBe('777');
    expect(formatted.message).toBe('Unknown ONTAP error');
    expect(formatted.target).toBe('/api/raw');
    expect(formatted.suggestion).toContain('Server error');
  });

  it('formats non-JSON body and status-based suggestion branches', () => {
    expect(formatOntapError(429, 'too many', '/api/foo').suggestion).toContain('Rate limit');
    expect(formatOntapError(500, 'boom', '/api/foo').suggestion).toContain('Server error');
    expect(formatOntapError(404, 'not found', '/api/foo').suggestion).toContain('Review');
    expect(formatOntapError(401, 'x', '/api/foo').suggestion).toContain('authentication');
    expect(
      formatOntapError(
        404,
        JSON.stringify({ error: { message: 'resource not found', target: '/api/foo' } }),
        '/api/foo'
      ).suggestion
    ).toContain('Verify');
    expect(
      formatOntapError(
        409,
        JSON.stringify({ error: { message: 'resource already exists', target: '/api/foo' } }),
        '/api/foo'
      ).suggestion
    ).toContain('already exists');
  });

  it('builds success response and sanitizes structured content', () => {
    const ok = successResponse({ a: 1 });
    expect(ok.structuredContent).toEqual({ result: { a: 1 } });
    expect(sanitizeStructuredContent({ keep: 1, drop: 2 }, ['keep'])).toEqual({ keep: 1 });
  });

  it('truncates oversized ontap error messages and appends fallback hint', () => {
    const veryLong = 'x'.repeat(2005);
    const err = errorResponse('ontap_execute', { message: veryLong });
    expect(err.isError).toBe(true);
    expect(err.content[0].text).toContain('[truncated; see server logs for full error]');
    expect(err.content[0].text).toContain('ontap_discover');
    expect(err.content[0].text).toContain('ontap_execute');
  });

  it('uses Unknown error fallback without ONTAP hint for non-ontap operations', () => {
    const err = errorResponse('volume_create', {});
    expect(err.content[0].text).toContain('Unknown error');
    expect(err.content[0].text).not.toContain('ontap_discover');
  });

  it('uses Unknown error for empty non-JSON response body', () => {
    const formatted = formatOntapError(400, '', '/api/foo');
    expect(formatted.message).toBe('Unknown error');
    expect(formatted.code).toBe('400');
  });
});
