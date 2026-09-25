#!/usr/bin/env node
/**
 * Live MCP integration test — same stdio transport as Cursor and Gemini CLI.
 *
 * Usage (after npm run build on each branch):
 *   node test/live/mcp-backup-list-live.mjs /path/to/build/index.js [--json-out report.json]
 */
import { writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverEntry = process.argv[2];
const jsonOutIndex = process.argv.indexOf('--json-out');
const jsonOut = jsonOutIndex >= 0 ? process.argv[jsonOutIndex + 1] : undefined;

if (!serverEntry) {
  console.error(
    'Usage: node test/live/mcp-backup-list-live.mjs /path/to/build/index.js [--json-out report.json]'
  );
  process.exit(1);
}

const projectId = process.env.GCNV_TEST_PROJECT_ID ?? 'g1p-astral-tst-host-01';
const location = process.env.GCNV_TEST_LOCATION ?? 'us-central1';
const backupVaultId = process.env.GCNV_TEST_BACKUP_VAULT ?? 'r3-vault-005332';
const pageSize = Number(process.env.GCNV_TEST_PAGE_SIZE ?? 5);

const toolInput = { projectId, location, backupVaultId, pageSize };

const report = {
  transport: 'stdio',
  serverEntry,
  step1_toolCall: {
    name: 'gcnv_backup_list',
    arguments: toolInput,
  },
  step2_mcpResult: null,
  step3_outcome: null,
};

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverEntry, '--transport', 'stdio'],
});

const client = new Client({ name: 'mcp-backup-list-live', version: '1.0.0' });

console.log('=== Live MCP gcnv_backup_list ===');
console.log('Transport: stdio (same as Cursor ~/.cursor/mcp.json and Gemini gemini-extension.json)');
console.log('Server binary:', serverEntry);
console.log('\n--- STEP 1: Tool call input (what client sends) ---');
console.log(JSON.stringify(report.step1_toolCall, null, 2));

try {
  await client.connect(transport);

  const result = await client.callTool({
    name: 'gcnv_backup_list',
    arguments: toolInput,
  });

  report.step2_mcpResult = {
    isError: Boolean(result.isError),
    content: result.content,
    structuredContent: result.structuredContent ?? null,
  };

  console.log('\n--- STEP 2: MCP tool result (what client receives) ---');
  console.log(JSON.stringify(report.step2_mcpResult, null, 2));

  if (result.isError) {
    report.step3_outcome = 'FAIL — MCP output validation rejected structuredContent';
    console.log('\n--- STEP 3: Outcome ---');
    console.log(report.step3_outcome);
    process.exitCode = 2;
  } else {
    report.step3_outcome = 'PASS — MCP returned validated structuredContent';
    console.log('\n--- STEP 3: Outcome ---');
    console.log(report.step3_outcome);
  }
} catch (error) {
  report.step2_mcpResult = {
    isError: true,
    exception: error instanceof Error ? error.message : String(error),
  };
  report.step3_outcome = 'FAIL — MCP client exception';
  console.log('\n--- STEP 2/3: Error ---');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.close();
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 2));
    console.log('\nWrote full report:', jsonOut);
  }
}
