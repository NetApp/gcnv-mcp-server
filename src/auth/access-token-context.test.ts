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

  it('uses default Authorization header when env var is unset', () => {
    delete process.env.GCNV_AUTH_HEADER;
    const token = accessTokenFromHttpHeaders({
      authorization: 'Bearer default-token',
    });
    expect(token).toBe('default-token');
  });

  it('reads first value when configured header is an array', () => {
    process.env.GCNV_AUTH_HEADER = 'X-Auth';
    const token = accessTokenFromHttpHeaders({
      'x-auth': ['Bearer first-token', 'Bearer second-token'],
    });
    expect(token).toBe('first-token');
  });

  it('returns undefined for blank bearer value after prefix', () => {
    process.env.GCNV_AUTH_HEADER = 'Authorization';
    const token = accessTokenFromHttpHeaders({
      authorization: 'Bearer   ',
    });
    expect(token).toBeUndefined();
  });

  it('returns undefined when configured header is missing', () => {
    process.env.GCNV_AUTH_HEADER = 'Authorization';
    const token = accessTokenFromHttpHeaders({});
    expect(token).toBeUndefined();
  });
});
