#!/usr/bin/env node
/**
 * Live MCP integration test — same stdio transport as Cursor and Gemini CLI.
 *
 * Usage (after npm run build on each branch):
 *   node test/live/mcp-backup-list-live.mjs /path/to/build/index.js
 *
 * Env:
 *   GCNV_TEST_PROJECT_ID   (default: g1p-astral-tst-host-01)
 *   GCNV_TEST_LOCATION     (default: us-central1)
 *   GCNV_TEST_BACKUP_VAULT (default: r3-vault-005332)
 *   GCNV_TEST_PAGE_SIZE    (default: 5)
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverEntry = process.argv[2];
if (!serverEntry) {
  console.error('Usage: node test/live/mcp-backup-list-live.mjs /path/to/build/index.js');
  process.exit(1);
}

const projectId = process.env.GCNV_TEST_PROJECT_ID ?? 'g1p-astral-tst-host-01';
const location = process.env.GCNV_TEST_LOCATION ?? 'us-central1';
const backupVaultId = process.env.GCNV_TEST_BACKUP_VAULT ?? 'r3-vault-005332';
const pageSize = Number(process.env.GCNV_TEST_PAGE_SIZE ?? 5);

const toolInput = { projectId, location, backupVaultId, pageSize };

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverEntry, '--transport', 'stdio'],
});

const client = new Client({ name: 'mcp-backup-list-live', version: '1.0.0' });

console.log('=== Live MCP gcnv_backup_list ===');
console.log('Server:', serverEntry);
console.log('Input:', JSON.stringify(toolInput, null, 2));

try {
  await client.connect(transport);

  const result = await client.callTool({
    name: 'gcnv_backup_list',
    arguments: toolInput,
  });

  console.log('\n--- MCP tool result ---');
  console.log('isError:', Boolean(result.isError));

  if (result.isError) {
    const text = result.content?.find((c) => c.type === 'text')?.text ?? JSON.stringify(result);
    console.log('Error output:\n', text);
    process.exitCode = 2;
  } else {
    const text = result.content?.find((c) => c.type === 'text')?.text;
    const structured = result.structuredContent;
    const backups = structured?.backups ?? [];
    console.log('backup count:', backups.length);
    if (backups.length > 0) {
      const sample = backups[0];
      console.log('first backupId:', sample.backupId);
      console.log('enforcedRetentionEndTime:', sample.enforcedRetentionEndTime ?? '(absent)');
      console.log('createTime:', sample.createTime ?? '(absent)');
    }
    if (text) {
      console.log('\nText preview (first 500 chars):\n', text.slice(0, 500));
    }
    console.log('\nResult: SUCCESS — MCP returned validated structuredContent');
  }
} catch (error) {
  console.error('\n--- MCP client error ---');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.close();
}
