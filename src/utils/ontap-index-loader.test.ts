import { describe, it, expect, beforeEach } from 'vitest';
import { loadIndex, _resetIndexCache } from './ontap-index-loader.js';

describe('loadIndex', () => {
  beforeEach(() => {
    _resetIndexCache();
  });

  it('loads the bundled index and exposes endpoints with the documented shape', async () => {
    const index = await loadIndex();
    expect(index.endpoints.length).toBeGreaterThan(0);
    for (const ep of index.endpoints) {
      expect(typeof ep.method).toBe('string');
      expect(typeof ep.path).toBe('string');
      expect(typeof ep.resource).toBe('string');
      expect(Array.isArray(ep.keywords)).toBe(true);
      expect(Array.isArray(ep.pathParams)).toBe(true);
    }
  });

  it('does not surface legacy decision metadata on any endpoint', async () => {
    // The published index is a curated allowlist with no policy-revealing
    // metadata: denial is a runtime concern surfaced via the canonical
    // scope_denied envelope, not a static field on the entry.
    const index = await loadIndex();
    for (const ep of index.endpoints as unknown as Array<Record<string, unknown>>) {
      expect(ep.decision).toBeUndefined();
      expect(ep.decisionSource).toBeUndefined();
      expect(ep.decisionReason).toBeUndefined();
      expect(ep.suggestedTool).toBeUndefined();
    }
  });

  it('does not surface legacy top-level version metadata', async () => {
    // The JSON ships bundled with the loader (Node subpath import) and tsc
    // enforces schema compatibility at build time, so no runtime version
    // check is needed and no version stamp is exposed.
    const index = (await loadIndex()) as unknown as Record<string, unknown>;
    expect(index.version).toBeUndefined();
    expect(index.schemaVersion).toBeUndefined();
  });

  it('returns a stable cached reference across calls', async () => {
    const a = await loadIndex();
    const b = await loadIndex();
    expect(a).toBe(b);
  });

  it('exposes an empty synonyms map even if the file omits it', async () => {
    const index = await loadIndex();
    expect(index.synonyms).toBeDefined();
    expect(typeof index.synonyms).toBe('object');
  });
});
