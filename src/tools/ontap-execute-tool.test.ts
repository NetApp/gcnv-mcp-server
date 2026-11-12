import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ontapExecuteTool } from './ontap-execute-tool.js';

describe('ontapExecuteTool', () => {
  const schema = z.object(ontapExecuteTool.inputSchema);
  const baseArgs = {
    projectId: 'p1',
    locationId: 'us-east1',
    storagePoolId: 'sp1',
    method: 'GET',
    ontapApiPath: '/api/storage/volumes',
  };

  it('accepts body as a JSON string or object', () => {
    expect(() =>
      schema.parse({
        ...baseArgs,
        method: 'POST',
        body: '{"name":"vol1"}',
      })
    ).not.toThrow();

    expect(() =>
      schema.parse({
        ...baseArgs,
        method: 'POST',
        body: { name: 'vol1', svm: { name: 'vs0' } },
      })
    ).not.toThrow();
  });

  it('accepts queryParams as a JSON string or object with string values', () => {
    expect(() =>
      schema.parse({
        ...baseArgs,
        queryParams: '{"max_records":"50","ontap_fields":"name,uuid"}',
      })
    ).not.toThrow();

    expect(() =>
      schema.parse({
        ...baseArgs,
        queryParams: { max_records: '50', ontap_fields: 'name,uuid' },
      })
    ).not.toThrow();
  });
});
