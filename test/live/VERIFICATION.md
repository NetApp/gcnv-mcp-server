# Live verification — `gcnv_backup_list` enforced retention bug

Real GCNV project, real backup vault, real MCP stdio transport.

**Test date:** 2026-09-25  
**Project:** `g1p-astral-tst-host-01`  
**Vault:** `r3-vault-005332` (14-day minimum enforced retention)  
**Backup:** `mcp-retention-live-test-2`

---

## Shared tool input (all clients)

Every client sends this to `gcnv_backup_list`:

```json
{
  "projectId": "g1p-astral-tst-host-01",
  "location": "us-central1",
  "backupVaultId": "r3-vault-005332",
  "pageSize": 3
}
```

**What GCNV API returns internally** (handler receives this):

```json
{
  "name": "projects/g1p-astral-tst-host-01/locations/us-central1/backupVaults/r3-vault-005332/backups/mcp-retention-live-test-2",
  "state": "CREATING",
  "enforcedRetentionEndTime": { "seconds": "1791522585", "nanos": 0 },
  "createTime": { "seconds": "1790312985", "nanos": 0 },
  "sourceVolume": "projects/644189374367/locations/us-central1/volumes/test-ext-vol-1"
}
```

---

## A. Cursor MCP

**Config:** `~/.cursor/mcp.json` → spawns server via stdio

### A1. Pre-fix (NON-WORKING) — main branch server

| Step | Detail |
|------|--------|
| **Server binary** | `/Users/aryaman/LlmProjects/gcnv-mcp-server/build/index.js` (main) |
| **1. Input** | See shared tool input above |
| **2. Handler builds** | `enforcedRetentionEndTime: { "seconds": "1791522585", "nanos": 0 }` (protobuf object, not formatted) |
| **3. MCP output to Cursor** | `structuredContent: null` |
| **4. Error returned** | See below |
| **5. Outcome** | **FAIL** |

```json
{
  "isError": true,
  "error": "MCP error -32602: Output validation error: Invalid structured content for tool gcnv_backup_list",
  "zodDetail": {
    "code": "invalid_type",
    "expected": "number",
    "received": "object",
    "path": ["backups", 0, "enforcedRetentionEndTime"],
    "message": "Expected number, received object"
  }
}
```

**Artifact:** `test/live/artifacts/cursor-prefix.json`

### A2. Post-fix (WORKING) — PR branch server

| Step | Detail |
|------|--------|
| **Server binary** | `mcp/gcnv-mcp-server/build/index.js` (this PR, after `npm run build`) |
| **1. Input** | Same shared tool input |
| **2. Handler builds** | `enforcedRetentionEndTime: "2026-10-09T05:09:45.000Z"` |
| **3. MCP output to Cursor** | Full `structuredContent` (see below) |
| **4. Outcome** | **PASS** |

```json
{
  "isError": false,
  "backups": [
    {
      "backupId": "mcp-retention-live-test-2",
      "backupVaultId": "r3-vault-005332",
      "state": "CREATING",
      "createTime": "2026-09-25T05:09:45.000Z",
      "enforcedRetentionEndTime": "2026-10-09T05:09:45.000Z",
      "sourceVolume": "projects/644189374367/locations/us-central1/volumes/test-ext-vol-1"
    }
  ]
}
```

**Artifact:** `test/live/artifacts/cursor-postfix.json`

**To reproduce in Cursor:** update `~/.cursor/mcp.json` `args[0]` to PR branch `build/index.js`, restart MCP, ask agent to call `gcnv_backup_list` with the shared input.

---

## B. Gemini CLI

**Config:** `gemini-extension.json` → `npx gcnv-mcp-server@latest` over stdio (same MCP protocol as Cursor)

Gemini CLI wraps the same `tools/call` → handler → `validateToolOutput` path. Use a **local build** while validating this PR:

```bash
cp test/live/gemini-settings.example.json .gemini/settings.json
npm run build
```

### B1. Pre-fix (NON-WORKING) — stdio MCP (Gemini transport path)

Run with main branch binary:

```bash
node test/live/mcp-backup-list-live.mjs /tmp/gcnv-mcp-main/build/index.js \
  --json-out test/live/artifacts/prefix-stdio.json
```

| Step | Payload |
|------|---------|
| **1. Input** | `{"name":"gcnv_backup_list","arguments":{...shared input...}}` |
| **2. Output** | `isError: true`, `structuredContent: null` |
| **3. Error text** | `Expected number, received object at backups[0].enforcedRetentionEndTime` |
| **4. Outcome** | **FAIL** |

**Artifact:** `test/live/artifacts/prefix-stdio.json`

### B2. Post-fix (WORKING) — stdio MCP (Gemini transport path)

```bash
npm run test:live
# writes test/live/artifacts/postfix-stdio.json
```

| Step | Payload |
|------|---------|
| **1. Input** | Same |
| **2. Output** | `isError: false`, full `structuredContent` with ISO timestamp |
| **3. Key field** | `"enforcedRetentionEndTime": "2026-10-09T05:09:45.000Z"` |
| **4. Outcome** | **PASS** |

**Artifact:** `test/live/artifacts/postfix-stdio.json`

### B3. Gemini CLI LLM session (optional)

After configuring `.gemini/settings.json` to local `build/index.js`:

```bash
gemini --skip-trust --approval-mode yolo -p \
  "Call gcnv_backup_list with projectId g1p-astral-tst-host-01 location us-central1 backupVaultId r3-vault-005332 pageSize 3. Show enforcedRetentionEndTime from first backup."
```

> **Note:** Gemini CLI auth was unavailable in the environment used to author this PR (`IneligibleTierError`). Steps B1/B2 use the identical stdio MCP layer Gemini invokes under the hood.

---

## Quick commands

```bash
# Post-fix (should PASS)
npm run build && npm run test:live

# Pre-fix (should FAIL, exit code 2)
git worktree add /tmp/gcnv-mcp-main main
(cd /tmp/gcnv-mcp-main && npm ci && npm run build)
node test/live/mcp-backup-list-live.mjs /tmp/gcnv-mcp-main/build/index.js
```
