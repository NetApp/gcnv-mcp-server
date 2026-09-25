#!/usr/bin/env node
/**
 * Verifies MCP output schemas over stdio transport (Gemini CLI path).
 * Run after: npm run build
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(repoRoot, 'build/index.js');

function arrayItemSchema(arrayFieldSchema) {
  return arrayFieldSchema?.items ?? arrayFieldSchema?.anyOf?.[0]?.items;
}

function fieldType(schemaNode) {
  if (!schemaNode) return undefined;
  if (schemaNode.type) return schemaNode.type;
  if (schemaNode.anyOf?.length === 2 && schemaNode.anyOf.some((entry) => entry.type === 'null')) {
    return schemaNode.anyOf.find((entry) => entry.type !== 'null')?.type;
  }
  return undefined;
}

const checks = [
  {
    tool: 'gcnv_backup_list',
    resolve: (outputSchema) =>
      arrayItemSchema(outputSchema?.properties?.backups)?.properties?.enforcedRetentionEndTime,
    label: 'backups[].enforcedRetentionEndTime',
    expected: 'string',
  },
  {
    tool: 'gcnv_backup_list',
    resolve: (outputSchema) =>
      arrayItemSchema(outputSchema?.properties?.backups)?.properties?.volumeUsagebytes,
    label: 'backups[].volumeUsagebytes',
    expected: 'number',
  },
  {
    tool: 'gcnv_replication_list',
    resolve: (outputSchema) =>
      arrayItemSchema(outputSchema?.properties?.replications)?.properties?.lastReplicationTime,
    label: 'replications[].lastReplicationTime',
    expected: 'string',
  },
  {
    tool: 'gcnv_storage_pool_list',
    resolve: (outputSchema) =>
      arrayItemSchema(outputSchema?.properties?.storagePools)?.properties?.qosType,
    label: 'storagePools[].qosType',
    expected: 'string',
  },
];

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverEntry],
  cwd: repoRoot,
});

const client = new Client({ name: 'verify-gemini-mcp-output-schemas', version: '1.0.0' });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();

  for (const check of checks) {
    const tool = tools.find((entry) => entry.name === check.tool);
    if (!tool?.outputSchema) {
      throw new Error(`${check.tool} missing outputSchema`);
    }

    const node = check.resolve(tool.outputSchema);
    const actual = fieldType(node);
    if (actual !== check.expected) {
      throw new Error(
        `${check.tool} ${check.label} expected ${check.expected}, got ${JSON.stringify(actual)}`
      );
    }
    console.log(`OK ${check.tool} ${check.label} -> ${check.expected}`);
  }

  console.log('Gemini MCP stdio output-schema verification passed');
  console.log(`- Connected to ${serverEntry}`);
  console.log(`- Verified ${checks.length} schema fields`);
  console.log('- Transport: stdio (same path used by Gemini CLI gemini-extension.json)');
} finally {
  await client.close();
}
