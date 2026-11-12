import { describe, expect, it, vi } from 'vitest';
import { sleep } from './sleep.js';

describe('sleep', () => {
  it('resolves after timer callback', async () => {
    vi.useFakeTimers();
    try {
      const p = sleep(250);
      await vi.advanceTimersByTimeAsync(250);
      await expect(p).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
