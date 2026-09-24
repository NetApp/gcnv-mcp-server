#!/usr/bin/env node
/**
 * Verifies gcnv_backup_list output schema over MCP stdio transport (Gemini CLI path).
 * Run after: npm run build
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(repoRoot, 'build/index.js');

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverEntry],
  cwd: repoRoot,
});

const client = new Client({ name: 'verify-gemini-mcp-backup-list', version: '1.0.0' });

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  const listTool = tools.find((tool) => tool.name === 'gcnv_backup_list');
  if (!listTool) {
    throw new Error('gcnv_backup_list tool not registered');
  }

  const backupItemSchema =
    listTool.outputSchema?.properties?.backups?.items ??
    listTool.outputSchema?.properties?.backups?.anyOf?.[0]?.items;

  const retentionSchema = backupItemSchema?.properties?.enforcedRetentionEndTime;
  if (!retentionSchema) {
    throw new Error('gcnv_backup_list output schema missing enforcedRetentionEndTime');
  }

  const retentionType = retentionSchema.type;
  if (retentionType !== 'string') {
    throw new Error(
      `expected enforcedRetentionEndTime type string, got ${JSON.stringify(retentionType)}`
    );
  }

  console.log('Gemini MCP stdio verification passed');
  console.log(`- Connected to ${serverEntry}`);
  console.log(`- Tool registered: ${listTool.name}`);
  console.log('- enforcedRetentionEndTime output type: string (ISO 8601)');
  console.log('- Transport: stdio (same path used by Gemini CLI gemini-extension.json)');
} finally {
  await client.close();
}
