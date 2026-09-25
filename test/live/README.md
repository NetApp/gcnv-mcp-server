# Live MCP integration test — `gcnv_backup_list`

Exercises the **real GCNV API** through the MCP stdio transport (same path as **Cursor** and **Gemini CLI**).

## Prerequisites

- `gcloud auth application-default login`
- Access to project `g1p-astral-tst-host-01` (or set env vars below)
- A backup vault with **minimum enforced retention** and at least one backup (vault `r3-vault-005332` was used for PR #62 proof)

## Run

```bash
npm run build

# POST-FIX (this branch)
node test/live/mcp-backup-list-live.mjs build/index.js

# PRE-FIX (main branch — build in a worktree first)
git worktree add /tmp/gcnv-mcp-main main
cd /tmp/gcnv-mcp-main && npm ci && npm run build
node /path/to/gcnv-mcp-server/test/live/mcp-backup-list-live.mjs /tmp/gcnv-mcp-main/build/index.js
```

Optional env:

```bash
export GCNV_TEST_PROJECT_ID=g1p-astral-tst-host-01
export GCNV_TEST_LOCATION=us-central1
export GCNV_TEST_BACKUP_VAULT=r3-vault-005332
export GCNV_TEST_PAGE_SIZE=5
```

## Expected results (2026-09-25, vault `r3-vault-005332`, backup `mcp-retention-live-test-2`)

### Pre-fix (main) — FAILS

```
Input: { projectId, location, backupVaultId: r3-vault-005332, pageSize: 5 }
GCNV API returns: enforcedRetentionEndTime: { seconds: "1791522585", nanos: 0 }
MCP error: Output validation error: Expected number, received object at backups[0].enforcedRetentionEndTime
exit code: 2
```

### Post-fix (this PR) — SUCCESS

```
Input: (same)
Handler output: enforcedRetentionEndTime: "2026-10-09T05:09:45.000Z"
backup count: 1
exit code: 0
```

## Cursor MCP

Cursor uses stdio MCP (`~/.cursor/mcp.json`). With the **old** server binary, the same call fails:

```
Tool: gcnv_backup_list
Input: { projectId: "g1p-astral-tst-host-01", location: "us-central1", backupVaultId: "r3-vault-005332", pageSize: 3 }
Error: Expected number, received object at backups[0].enforcedRetentionEndTime
```

Point `mcp.json` at `build/index.js` from **this branch** after `npm run build` to verify the fix in Cursor.

## Gemini CLI

Gemini uses the same stdio transport (`gemini-extension.json`). From this repo after building:

```bash
npm run build
gemini --skip-trust --approval-mode yolo -p "Call gcnv_backup_list with projectId g1p-astral-tst-host-01 location us-central1 backupVaultId r3-vault-005332 pageSize 3 and show enforcedRetentionEndTime from the first backup"
```

Configure Gemini to use the local build (not `npx gcnv-mcp-server@latest`) while validating the PR branch.
