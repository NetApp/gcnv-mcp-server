/**
 * Remote MCP workflow prompts catalog client.
 *
 * When GCNV_MCP_REMOTE_PROMPTS is enabled, fetches GET {GCNV_MCP_PROMPTS_URL}
 * (catalog including messages), caches for TTL, and substitutes {{arg}} on get.
 * Failures return an empty catalog — tools must keep working.
 */
import { logger } from '../logger.js';

const log = logger.child({ module: 'remote-prompt-client' });

export interface RemotePromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface RemotePromptMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RemotePrompt {
  name: string;
  description?: string;
  arguments?: RemotePromptArgument[];
  messages: RemotePromptMessage[];
}

interface CatalogCache {
  prompts: RemotePrompt[];
  expiresAt: number;
}

let cache: CatalogCache | null = null;
let inflightFetch: Promise<RemotePrompt[]> | null = null;

const RESERVED_ARG_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeArgKey(key: string): boolean {
  return key.length > 0 && !RESERVED_ARG_KEYS.has(key);
}

function isSupportedPromptRole(role: string): role is RemotePromptMessage['role'] {
  return role === 'user' || role === 'assistant';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolFlag(raw: string | undefined): boolean {
  const value = (raw || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function remotePromptsEnabled(): boolean {
  return parseBoolFlag(process.env.GCNV_MCP_REMOTE_PROMPTS);
}

export function remotePromptsUrl(): string {
  return (process.env.GCNV_MCP_PROMPTS_URL || '').trim();
}

function timeoutMs(): number {
  return parsePositiveInt(process.env.GCNV_MCP_PROMPTS_TIMEOUT_MS, 3000);
}

function cacheTtlMs(): number {
  return parsePositiveInt(process.env.GCNV_MCP_PROMPTS_CACHE_TTL_MS, 300_000);
}

function authToken(): string {
  return (process.env.GCNV_MCP_PROMPTS_TOKEN || '').trim();
}

function validatePrompt(value: unknown): RemotePrompt | null {
  if (!isObject(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) return null;
  const messagesRaw = value.messages;
  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) return null;
  const messages: RemotePromptMessage[] = [];
  for (const msg of messagesRaw) {
    if (!isObject(msg)) continue;
    const role = typeof msg.role === 'string' ? msg.role : '';
    const content = typeof msg.content === 'string' ? msg.content : '';
    if (!isSupportedPromptRole(role) || !content) continue;
    messages.push({ role, content });
  }
  if (messages.length === 0) return null;

  const argsRaw = value.arguments;
  const args: RemotePromptArgument[] = [];
  if (Array.isArray(argsRaw)) {
    for (const arg of argsRaw) {
      if (!isObject(arg)) continue;
      const argName = typeof arg.name === 'string' ? arg.name.trim() : '';
      if (!argName || !isSafeArgKey(argName)) continue;
      args.push({
        name: argName,
        description: typeof arg.description === 'string' ? arg.description : '',
        required: Boolean(arg.required),
      });
    }
  }

  return {
    name,
    description: typeof value.description === 'string' ? value.description : '',
    arguments: args,
    messages,
  };
}

function validateCatalog(payload: unknown): RemotePrompt[] {
  if (!isObject(payload) || !Array.isArray(payload.prompts)) return [];
  const prompts: RemotePrompt[] = [];
  for (const item of payload.prompts) {
    const prompt = validatePrompt(item);
    if (prompt) prompts.push(prompt);
  }
  return prompts;
}

/** Reset cache (tests). */
export function clearRemotePromptCache(): void {
  cache = null;
  inflightFetch = null;
}

async function loadCatalogFromNetwork(): Promise<RemotePrompt[]> {
  const endpoint = remotePromptsUrl();
  if (!endpoint) {
    log.warn('GCNV_MCP_REMOTE_PROMPTS enabled but GCNV_MCP_PROMPTS_URL is empty');
    return [];
  }

  const now = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = authToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      log.warn({ status: response.status, endpoint }, 'Remote prompts catalog request failed');
      cache = { prompts: [], expiresAt: now + Math.min(cacheTtlMs(), 30_000) };
      return [];
    }

    const payload = (await response.json()) as unknown;
    const prompts = validateCatalog(payload);
    cache = { prompts, expiresAt: now + cacheTtlMs() };
    return prompts;
  } catch (err) {
    log.warn({ err, endpoint }, 'Remote prompts catalog request failed');
    cache = { prompts: [], expiresAt: now + Math.min(cacheTtlMs(), 30_000) };
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCatalog(): Promise<RemotePrompt[]> {
  if (!remotePromptsEnabled()) return [];

  const endpoint = remotePromptsUrl();
  if (!endpoint) {
    log.warn('GCNV_MCP_REMOTE_PROMPTS enabled but GCNV_MCP_PROMPTS_URL is empty');
    return [];
  }

  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.prompts;
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = loadCatalogFromNetwork().finally(() => {
    inflightFetch = null;
  });
  return inflightFetch;
}

export function substituteArgs(template: string, args: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      return args[key] ?? '';
    }
    return `{{${key}}}`;
  });
}

export async function getRemotePrompt(
  name: string,
  args: Record<string, string> = {}
): Promise<RemotePrompt | null> {
  const prompts = await fetchCatalog();
  const found = prompts.find((prompt) => prompt.name === name);
  if (!found) return null;
  return {
    ...found,
    messages: found.messages.map((message) => ({
      role: message.role,
      content: substituteArgs(message.content, args),
    })),
  };
}
