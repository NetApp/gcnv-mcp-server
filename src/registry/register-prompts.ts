/**
 * Register remote workflow prompts on the MCP server.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  fetchCatalog,
  getRemotePrompt,
  remotePromptsEnabled,
  remotePromptsUrl,
  type RemotePrompt,
} from '../prompts/remote-prompt-client.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'register-prompts' });

const RESERVED_ARG_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeArgKey(key: string): boolean {
  return key.length > 0 && !RESERVED_ARG_KEYS.has(key);
}

function buildArgsSchema(prompt: RemotePrompt): Record<string, z.ZodTypeAny> | undefined {
  const args = prompt.arguments || [];
  if (args.length === 0) return undefined;
  const shape = Object.create(null) as Record<string, z.ZodTypeAny>;
  for (const arg of args) {
    if (!isSafeArgKey(arg.name)) {
      log.warn({ name: arg.name, prompt: prompt.name }, 'Skipping unsafe remote prompt arg name');
      continue;
    }
    const base = z.string().describe(arg.description || arg.name);
    shape[arg.name] = arg.required ? base : base.optional();
  }
  if (Object.keys(shape).length === 0) return undefined;
  return shape;
}

function toArgRecord(args: Record<string, unknown> | undefined): Record<string, string> {
  const out = Object.create(null) as Record<string, string>;
  if (!args) return out;
  for (const [key, value] of Object.entries(args)) {
    if (!isSafeArgKey(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      out[key] = value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      out[key] = String(value);
      continue;
    }
    if (typeof value === 'symbol') {
      out[key] = value.toString();
    }
  }
  return out;
}

/**
 * When remote prompts are enabled, fetch the catalog and register each prompt.
 * Failures leave the server with tools only (empty prompts).
 */
export async function registerAllPrompts(mcpServer: McpServer): Promise<void> {
  if (!remotePromptsEnabled()) {
    return;
  }
  if (!remotePromptsUrl()) {
    log.warn('Remote prompts enabled but GCNV_MCP_PROMPTS_URL is empty; skipping prompts');
    return;
  }

  let prompts: RemotePrompt[];
  try {
    prompts = await fetchCatalog();
  } catch (err) {
    log.warn({ err }, 'Failed to load remote prompts; continuing with tools only');
    return;
  }

  if (prompts.length === 0) {
    log.warn('Remote prompts catalog empty; continuing with tools only');
    return;
  }

  const seen = new Set<string>();
  let registered = 0;
  for (const prompt of prompts) {
    if (seen.has(prompt.name)) {
      log.warn({ name: prompt.name }, 'Skipping duplicate remote prompt');
      continue;
    }
    seen.add(prompt.name);

    const argsSchema = buildArgsSchema(prompt);
    try {
      mcpServer.registerPrompt(
        prompt.name,
        {
          title: prompt.name,
          description: prompt.description || prompt.name,
          ...(argsSchema ? { argsSchema } : {}),
        },
        async (args) => {
          const filled = await getRemotePrompt(
            prompt.name,
            toArgRecord(args as Record<string, unknown>)
          );
          const messages = (filled?.messages || prompt.messages).map((message) => ({
            role: message.role,
            content: {
              type: 'text' as const,
              text: message.content,
            },
          }));
          return { messages };
        }
      );
      registered += 1;
    } catch (err) {
      log.warn({ err, name: prompt.name }, 'Failed to register remote prompt; skipping');
    }
  }

  if (registered === 0) {
    log.warn('No remote prompts registered; continuing with tools only');
    return;
  }

  log.info({ count: registered }, 'Registered remote MCP prompts');
}
