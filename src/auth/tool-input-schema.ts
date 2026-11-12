import { z, type ZodObject, type ZodRawShape } from 'zod';
import { isDelegatedAccessTokenEnabled } from './delegated-access-token.js';

/**
 * Build the MCP tool input schema. Delegated access tokens are never advertised
 * in list_tools schemas. When GCNV_STDIO_DELEGATED_ACCESS_TOKEN is enabled,
 * passthrough allows the runtime-only stdio argument through validation.
 */
export function buildToolInputSchema(shape: ZodRawShape): ZodObject<any> {
  const base = z.object(shape);
  return isDelegatedAccessTokenEnabled() ? base.passthrough() : base;
}
