import { afterEach, describe, expect, it } from 'vitest';
import { isDelegatedAccessTokenEnabled } from './delegated-access-token.js';
import { buildToolInputSchema } from './tool-input-schema.js';
import { z } from 'zod';

describe('delegated-access-token', () => {
  const originalFlag = process.env.GCNV_STDIO_DELEGATED_ACCESS_TOKEN;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.GCNV_STDIO_DELEGATED_ACCESS_TOKEN;
    } else {
      process.env.GCNV_STDIO_DELEGATED_ACCESS_TOKEN = originalFlag;
    }
  });

  it('is disabled by default', () => {
    delete process.env.GCNV_STDIO_DELEGATED_ACCESS_TOKEN;
    expect(isDelegatedAccessTokenEnabled()).toBe(false);
  });

  it('enables for common truthy env values', () => {
    for (const value of ['true', '1', 'yes', ' TRUE ']) {
      process.env.GCNV_STDIO_DELEGATED_ACCESS_TOKEN = value;
      expect(isDelegatedAccessTokenEnabled()).toBe(true);
    }
  });

  it('strips runtime-only args from parsed input when disabled', () => {
    delete process.env.GCNV_STDIO_DELEGATED_ACCESS_TOKEN;
    const schema = buildToolInputSchema({ value: z.string() });
    const parsed = schema.parse({
      value: 'x',
      _stdio_delegated_google_access_token: 'should-not-pass',
    });
    expect(parsed).toEqual({ value: 'x' });
  });

  it('accepts runtime delegated-token arg via passthrough when enabled without exposing it in schema', () => {
    process.env.GCNV_STDIO_DELEGATED_ACCESS_TOKEN = 'true';
    const schema = buildToolInputSchema({ value: z.string() });
    expect(schema.shape).not.toHaveProperty('_stdio_delegated_google_access_token');
    const parsed = schema.parse({
      value: 'x',
      _stdio_delegated_google_access_token: 'token-from-rm',
    });
    expect(parsed).toEqual({
      value: 'x',
      _stdio_delegated_google_access_token: 'token-from-rm',
    });
  });
});
