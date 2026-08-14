import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearRemotePromptCache,
  fetchCatalog,
  getRemotePrompt,
  remotePromptsEnabled,
  substituteArgs,
} from './remote-prompt-client.js';

describe('remote-prompt-client', () => {
  afterEach(() => {
    clearRemotePromptCache();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is disabled by default', () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', undefined);
    expect(remotePromptsEnabled()).toBe(false);
  });

  it('returns empty catalog when flag is off', async () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', '0');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCatalog()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and caches catalog when enabled', async () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', '1');
    vi.stubEnv('GCNV_MCP_PROMPTS_URL', 'https://mc.example/v1/mcp-prompts');
    vi.stubEnv('GCNV_MCP_PROMPTS_TOKEN', 'secret');
    vi.stubEnv('GCNV_MCP_PROMPTS_CACHE_TTL_MS', '60000');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        prompts: [
          {
            name: 'create_volume',
            description: 'Create volume',
            arguments: [{ name: 'volumeId', required: true }],
            messages: [{ role: 'user', content: 'Create {{volumeId}}' }],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchCatalog();
    const second = await fetchCatalog();
    expect(first).toHaveLength(1);
    expect(first[0]?.name).toBe('create_volume');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Authorization).toBe('Bearer secret');
  });

  it('collapses concurrent catalog fetches into one network call', async () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', '1');
    vi.stubEnv('GCNV_MCP_PROMPTS_URL', 'https://mc.example/v1/mcp-prompts');
    vi.stubEnv('GCNV_MCP_PROMPTS_CACHE_TTL_MS', '60000');

    let resolveFetch: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = fetchCatalog();
    const second = fetchCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.({
      ok: true,
      json: async () => ({
        prompts: [
          {
            name: 'create_arp',
            description: 'ARP',
            messages: [{ role: 'user', content: 'Protect volume' }],
          },
        ],
      }),
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      [
        expect.objectContaining({
          name: 'create_arp',
        }),
      ],
      [
        expect.objectContaining({
          name: 'create_arp',
        }),
      ],
    ]);
  });

  it('drops unsupported message roles from catalog payloads', async () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', '1');
    vi.stubEnv('GCNV_MCP_PROMPTS_URL', 'https://mc.example/v1/mcp-prompts');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prompts: [
            {
              name: 'bad_role',
              description: 'Bad role',
              messages: [{ role: 'system', content: 'ignored' }],
            },
            {
              name: 'good_role',
              description: 'Good role',
              messages: [{ role: 'user', content: 'kept' }],
            },
          ],
        }),
      })
    );

    const prompts = await fetchCatalog();
    expect(prompts.map((prompt) => prompt.name)).toEqual(['good_role']);
    expect(prompts[0]?.messages[0]?.role).toBe('user');
  });

  it('drops unsafe argument names from catalog payloads', async () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', '1');
    vi.stubEnv('GCNV_MCP_PROMPTS_URL', 'https://mc.example/v1/mcp-prompts');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prompts: [
            {
              name: 'unsafe_args',
              description: 'Unsafe args',
              arguments: [
                { name: '__proto__', required: true },
                { name: 'constructor', required: false },
                { name: 'volumeName', required: true },
              ],
              messages: [{ role: 'user', content: 'Protect {{volumeName}}' }],
            },
          ],
        }),
      })
    );

    const prompts = await fetchCatalog();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.arguments?.map((arg) => arg.name)).toEqual(['volumeName']);
  });

  it('returns empty on timeout/network error', async () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', '1');
    vi.stubEnv('GCNV_MCP_PROMPTS_URL', 'https://mc.example/v1/mcp-prompts');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchCatalog()).resolves.toEqual([]);
  });

  it('substitutes args and leaves unknown placeholders', () => {
    expect(substituteArgs('Hello {{name}} {{missing}}', { name: 'Ada' })).toBe(
      'Hello Ada {{missing}}'
    );
  });

  it('getRemotePrompt fills args and returns null for missing name', async () => {
    vi.stubEnv('GCNV_MCP_REMOTE_PROMPTS', '1');
    vi.stubEnv('GCNV_MCP_PROMPTS_URL', 'https://mc.example/v1/mcp-prompts');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prompts: [
            {
              name: 'create_arp',
              description: 'ARP',
              messages: [{ role: 'user', content: 'Protect {{volumeName}}' }],
            },
          ],
        }),
      })
    );

    const prompt = await getRemotePrompt('create_arp', { volumeName: 'vol1' });
    expect(prompt?.messages[0]?.content).toBe('Protect vol1');
    await expect(getRemotePrompt('missing')).resolves.toBeNull();
  });
});
