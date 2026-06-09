import { describe, it, expect } from 'vitest';
import { preflightValidate } from './ontap-preflight-validator.js';
import { ApiIndex } from './ontap-index-loader.js';
import {
  buildScopeDeniedEnvelope,
  OUT_OF_SCOPE_REJECTION_REASON,
} from './scope-denied-envelope.js';

const testIndex: ApiIndex = {
  synonyms: {},
  categories: [
    { resource: 'volume', count: 4 },
    { resource: 'qos_policy', count: 3 },
  ],
  endpoints: [
    {
      resource: 'volume',
      keywords: ['vol'],
      method: 'GET',
      path: '/api/storage/volumes',
      pathParams: [],
      description: 'List volumes',
      hint: null,
      body: null,
    },
    {
      resource: 'volume',
      keywords: ['vol'],
      method: 'GET',
      path: '/api/storage/volumes/{uuid}',
      pathParams: ['uuid'],
      description: 'Get volume by UUID',
      hint: null,
      body: null,
    },
    {
      resource: 'volume',
      keywords: ['vol'],
      method: 'POST',
      path: '/api/storage/volumes',
      pathParams: [],
      description: 'Create volume',
      hint: null,
      body: { name: 'vol1', svm: { name: 'vs0' }, size: '2GB' },
    },
    {
      resource: 'volume',
      keywords: ['vol'],
      method: 'DELETE',
      path: '/api/storage/volumes/{uuid}',
      pathParams: ['uuid'],
      description: 'Delete volume',
      hint: null,
      body: null,
    },
    {
      resource: 'qos_policy',
      keywords: ['qos'],
      method: 'GET',
      path: '/api/storage/qos/policies',
      pathParams: [],
      description: 'List QoS policies',
      hint: null,
      body: null,
    },
    {
      resource: 'qos_policy',
      keywords: ['qos'],
      method: 'POST',
      path: '/api/storage/qos/policies',
      pathParams: [],
      description: 'Create QoS policy',
      hint: null,
      body: { name: 'my-policy', svm: { name: 'vs0' }, fixed: { max_throughput_iops: '1000' } },
    },
    {
      resource: 'qos_policy',
      keywords: ['qos'],
      method: 'PATCH',
      path: '/api/storage/qos/policies/{uuid}',
      pathParams: ['uuid'],
      description: 'Update QoS policy',
      hint: null,
      body: {},
    },
  ],
};

describe('preflightValidate', () => {
  describe('endpoints absent from the index', () => {
    it('rejects unrecognized GET paths with the canonical scope_denied envelope', () => {
      const result = preflightValidate('GET', '/api/some/unknown/path', undefined, testIndex);
      expect(result.valid).toBe(false);
      expect(result.scopeDenied?.error).toBe('scope_denied');
      expect(result.scopeDenied?.source).toBe('preflight');
      expect(result.scopeDenied?.reason).toBe(OUT_OF_SCOPE_REJECTION_REASON);
    });

    it('rejects unrecognized POST paths with the canonical scope_denied envelope', () => {
      const result = preflightValidate('POST', '/api/some/unknown/path', { name: 'x' }, testIndex);
      expect(result.valid).toBe(false);
      expect(result.scopeDenied?.error).toBe('scope_denied');
      expect(result.scopeDenied?.source).toBe('preflight');
      expect(result.scopeDenied?.reason).toBe(OUT_OF_SCOPE_REJECTION_REASON);
    });

    it('rejects unrecognized DELETE paths with the canonical scope_denied envelope', () => {
      const result = preflightValidate('DELETE', '/api/some/unknown/path', undefined, testIndex);
      expect(result.valid).toBe(false);
      expect(result.scopeDenied?.source).toBe('preflight');
      expect(result.scopeDenied?.reason).toBe(OUT_OF_SCOPE_REJECTION_REASON);
    });

    it('uses neutral wording that does not leak why the path is absent', () => {
      // The wording must not let an LLM (or an attacker watching tool output)
      // distinguish "unknown to the tool" from "intentionally filtered out
      // by policy". This assertion locks the no-leak contract.
      const result = preflightValidate('PATCH', '/api/some/private/thing', { x: 1 }, testIndex);
      const message = result.scopeDenied?.reason ?? '';
      for (const forbidden of ['not found', 'unknown', 'swagger', 'index', 'denied', 'rbac']) {
        expect(message.toLowerCase()).not.toContain(forbidden);
      }
    });

    it('produces an envelope structurally identical to a synthetic runtime scope_denied', () => {
      // Pre-flight "not in index" and a runtime ontap-layer denial must look
      // the same to the LLM (modulo `source` field). The keys, retryability
      // flag, and error discriminator must match.
      const preflightResult = preflightValidate(
        'GET',
        '/api/some/unknown/path',
        undefined,
        testIndex
      );
      const runtime = buildScopeDeniedEnvelope({
        source: 'ontap',
        reason: 'something else',
      });
      const preflight = preflightResult.scopeDenied!;
      expect(Object.keys(preflight).sort()).toEqual(Object.keys(runtime).sort());
      expect(preflight.error).toBe(runtime.error);
      expect(preflight.retryability).toBe(runtime.retryability);
    });
  });

  describe('method check', () => {
    it('rejects invalid method for a known path', () => {
      const result = preflightValidate('DELETE', '/api/storage/volumes', undefined, testIndex);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Method DELETE is not valid');
      expect(result.suggestion).toContain('GET, POST');
    });

    it('accepts valid method for a known path', () => {
      const result = preflightValidate('GET', '/api/storage/volumes', undefined, testIndex);
      expect(result.valid).toBe(true);
    });

    it('accepts method when path has concrete UUID segment', () => {
      const result = preflightValidate('GET', '/api/storage/volumes/abc-123', undefined, testIndex);
      expect(result.valid).toBe(true);
    });
  });

  describe('path placeholder check', () => {
    it('rejects path with unresolved {uuid} placeholder', () => {
      const result = preflightValidate('GET', '/api/storage/volumes/{uuid}', undefined, testIndex);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unresolved placeholders');
      expect(result.suggestion).toContain('{uuid}');
    });
  });

  describe('body check for POST/PATCH', () => {
    it('rejects POST with missing body when index expects body', () => {
      const result = preflightValidate('POST', '/api/storage/volumes', undefined, testIndex);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('requires a request body');
      expect(result.suggestion).toContain('name, svm, size');
      expect(result.expectedBody).toBeDefined();
    });

    it('rejects POST with empty body when index expects body', () => {
      const result = preflightValidate('POST', '/api/storage/volumes', {}, testIndex);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('requires a request body');
    });

    it('rejects POST with body that has none of the expected keys', () => {
      const result = preflightValidate(
        'POST',
        '/api/storage/qos/policies',
        { something: 'else' },
        testIndex
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing all expected fields');
    });

    it('accepts POST with body containing some expected keys', () => {
      const result = preflightValidate(
        'POST',
        '/api/storage/qos/policies',
        { name: 'my-policy', svm: { name: 'vs0' } },
        testIndex
      );
      expect(result.valid).toBe(true);
    });

    it('rejects POST when a generated required body field is missing', () => {
      const requiredIndex: ApiIndex = {
        ...testIndex,
        endpoints: [
          ...testIndex.endpoints,
          {
            resource: 'cluster',
            keywords: ['cluster'],
            method: 'POST',
            path: '/api/cluster',
            pathParams: [],
            description: 'Create cluster',
            hint: 'Required body fields from ONTAP swagger: name, password.',
            body: { name: '<name>', password: '<password>' },
            requiredBody: [['name'], ['password']],
          },
        ],
      };

      const result = preflightValidate('POST', '/api/cluster', { name: 'cluster1' }, requiredIndex);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing required field');
      expect(result.error).toContain('password');
    });

    it('accepts any one field from a required body alternative group', () => {
      const requiredIndex: ApiIndex = {
        ...testIndex,
        endpoints: [
          ...testIndex.endpoints,
          {
            resource: 'svm',
            keywords: ['svm'],
            method: 'POST',
            path: '/api/svm/svms',
            pathParams: [],
            description: 'Create SVM',
            hint: 'Required body fields from ONTAP swagger: name, ipspace.name or ipspace.uuid.',
            body: { name: '<name>', ipspace: { name: '<name>' } },
            requiredBody: [['name'], ['ipspace.name', 'ipspace.uuid']],
          },
        ],
      };

      const result = preflightValidate(
        'POST',
        '/api/svm/svms',
        { name: 'vs0', ipspace: { uuid: 'ipspace-uuid' } },
        requiredIndex
      );
      expect(result.valid).toBe(true);
    });

    it('accepts PATCH with empty body when index body template is empty', () => {
      const result = preflightValidate('PATCH', '/api/storage/qos/policies/abc-123', {}, testIndex);
      expect(result.valid).toBe(true);
    });

    it('does not check body for GET requests', () => {
      const result = preflightValidate('GET', '/api/storage/volumes', undefined, testIndex);
      expect(result.valid).toBe(true);
    });
  });

  describe('combined checks', () => {
    it('method check fires before body check', () => {
      const result = preflightValidate('PATCH', '/api/storage/volumes', undefined, testIndex);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Method PATCH is not valid');
    });
  });

  describe('Private-CLI scope exclusion', () => {
    it('rejects bare /api/private/cli with a scope_denied envelope', () => {
      const result = preflightValidate('POST', '/api/private/cli', { command: 'x' }, testIndex);
      expect(result.valid).toBe(false);
      expect(result.scopeDenied?.source).toBe('preflight');
    });

    it('rejects /api/private/cli/* with a scope_denied envelope', () => {
      const result = preflightValidate('GET', '/api/private/cli/volume', undefined, testIndex);
      expect(result.valid).toBe(false);
      expect(result.scopeDenied).toBeDefined();
      expect(result.scopeDenied?.error).toBe('scope_denied');
      expect(result.scopeDenied?.retryability).toBe(false);
      expect(result.scopeDenied?.source).toBe('preflight');
      expect(result.scopeDenied?.reason).toContain('out of scope');
    });

    it('rejects nested Private-CLI paths', () => {
      const result = preflightValidate(
        'POST',
        '/api/private/cli/storage/aggregate/show',
        { foo: 'bar' },
        testIndex
      );
      expect(result.valid).toBe(false);
      expect(result.scopeDenied?.source).toBe('preflight');
    });

    it('does not reject paths that merely contain /private/ outside the cli prefix', () => {
      // Boundary: only /api/private/cli/ is excluded.
      const otherPrivate: ApiIndex = {
        ...testIndex,
        endpoints: [
          {
            ...testIndex.endpoints[0],
            method: 'GET',
            path: '/api/private/something/else',
          },
        ],
      };
      const result = preflightValidate(
        'GET',
        '/api/private/something/else',
        undefined,
        otherPrivate
      );
      expect(result.valid).toBe(true);
    });
  });
});
