import { describe, it, expect, afterEach } from 'vitest';
import {
  accessTokenFromHttpHeaders,
  currentRequestAccessToken,
  runWithRequestAccessToken,
} from '../auth/access-token-context.js';

describe('access-token-context', () => {
  const originalAuthHeader = process.env.GCNV_AUTH_HEADER;

  afterEach(() => {
    if (originalAuthHeader === undefined) delete process.env.GCNV_AUTH_HEADER;
    else process.env.GCNV_AUTH_HEADER = originalAuthHeader;
  });

  it('sets and reads token from request context', () => {
    void runWithRequestAccessToken('request-token', () => {
      expect(currentRequestAccessToken()).toBe('request-token');
    });
  });

  it('returns undefined with no request context', () => {
    expect(currentRequestAccessToken()).toBeUndefined();
  });

  it('parses bearer token from configured header', () => {
    process.env.GCNV_AUTH_HEADER = 'Authorization';
    const token = accessTokenFromHttpHeaders({
      authorization: 'Bearer header-token',
    });
    expect(token).toBe('header-token');
  });

  it('returns undefined for non-bearer headers', () => {
    process.env.GCNV_AUTH_HEADER = 'Authorization';
    const token = accessTokenFromHttpHeaders({
      authorization: 'Basic abc',
    });
    expect(token).toBeUndefined();
  });
});
