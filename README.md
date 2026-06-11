# Google Cloud NetApp Volumes MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for managing [Google Cloud NetApp Volumes](https://cloud.google.com/netapp/volumes/docs) (GCNV) resources through AI assistants such as Gemini CLI, Cursor, and other MCP-compatible clients.

## Supported Resources

| Resource              | Operations                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| **Storage Pools**     | create, get, list, update, delete, validate directory service                               |
| **Volumes**           | create, get, list, update, delete                                                           |
| **Snapshots**         | create, get, list, update, delete, revert                                                   |
| **Backup Vaults**     | create, get, list, update, delete                                                           |
| **Backups**           | create, get, list, update, delete, restore, restore files                                   |
| **Backup Policies**   | create, get, list, update, delete                                                           |
| **Replications**      | create, get, list, update, delete, stop, resume, reverse direction, sync, establish peering |
| **Active Directory**  | create, get, list, update, delete                                                           |
| **KMS Configs**       | create, get, list, update, delete, verify, encrypt volumes                                  |
| **Quota Rules**       | create, get, list, update, delete                                                           |
| **Host Groups**       | create, get, list, update, delete                                                           |
| **Operations**        | get, list, cancel                                                                           |
| **Logs / Events**     | list logs, list errors, list events, summarize (Cloud Logging, read-only)                   |
| **ONTAP Expert Mode** | discover and execute supported ONTAP REST operations for ONTAP-mode pools                   |

## Prerequisites

- Node.js 18 or higher
- A Google Cloud project with the [NetApp Volumes API](https://cloud.google.com/netapp/volumes/docs) enabled
- Google Cloud authentication credentials (see [Authentication](#authentication))

## Quick Start

Run the published package directly (no local build required):

```bash
npx gcnv-mcp-server@latest --transport stdio
```

Or install via the Gemini CLI extension workflow:

```bash
# 1. Authenticate
gcloud auth login
gcloud auth application-default login

# 2. Install the extension
gemini extension install <repository-url>

# 3. Verify
gemini mcp list
```

> Gemini automatically starts the MCP server when a linked extension needs it. No manual `npm start` is required for normal usage.

## Authentication

The server uses Google Cloud credentials to authenticate API requests. Configure one of the following before invoking any tool:

- **Application Default Credentials (recommended)**

```bash
gcloud auth application-default login
```

- **Service account key file**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

## Transport Modes

The server supports **stdio** (default) and **HTTP/SSE** transports.

### Stdio (default)

Used automatically by Gemini CLI and other stdio-based MCP clients.

```bash
npm start                          # default stdio
npm run start:stdio                # explicit
```

### HTTP/SSE

For web-based MCP clients or remote access.

```bash
npm run start:http                 # port 3000
npm start -- -t http -p 8080       # custom port
```

| Option              | Description       | Default |
| ------------------- | ----------------- | ------- |
| `--transport`, `-t` | `stdio` or `http` | `stdio` |
| `--port`, `-p`      | HTTP listen port  | `3000`  |

HTTP endpoint: `http://localhost:<port>/message`

> **Security note:** The HTTP/SSE transport does not provide built-in TLS. If you expose it beyond a local trusted client, use customer-managed TLS and network access controls, such as a reverse proxy, VPN, service mesh, or SSH tunnel. Do not expose the MCP HTTP endpoint directly to the public internet.

## Tool Reference

### Storage Pool Tools

| Tool                                           | Description                                                 |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `gcnv_storage_pool_create`                     | Create a storage pool (FLEX / STANDARD / PREMIUM / EXTREME) |
| `gcnv_storage_pool_get`                        | Get storage pool details                                    |
| `gcnv_storage_pool_list`                       | List storage pools (supports pagination and filtering)      |
| `gcnv_storage_pool_update`                     | Update pool capacity, description, labels, QoS, or type     |
| `gcnv_storage_pool_delete`                     | Delete a storage pool                                       |
| `gcnv_storage_pool_validate_directory_service` | Validate attached directory service                         |

**Service level guidance:**

- **FLEX** -- Smaller minimums, broader region availability, independent performance scaling. Minimum: 1024 GiB (FILE/UNIFIED) or 6144 GiB (UNIFIED large capacity).
- **STANDARD / PREMIUM / EXTREME** -- Classic tiers with fixed performance-to-capacity ratio. Minimum: 2048 GiB.
- `serviceLevel` is accepted case-insensitively (e.g. `flex` or `FLEX`).
- FLEX pools in a region-level location require both `zone` and `replicaZone`; zone-level locations satisfy this automatically.
- `storagePoolType` accepts `FILE` or `UNIFIED`; `UNIFIED` is only available for FLEX.
- `scaleType`: only set to `SCALE_TYPE_SCALEOUT` when creating a large capacity FLEX `UNIFIED` pool. Omit for all other pools (defaults to `SCALE_TYPE_DEFAULT`).
- `mode`: defaults to `DEFAULT` for a standard pool, or set to `ONTAP` to create an ONTAP-mode pool that exposes advanced ONTAP features (SnapMirror, QoS policies, direct ONTAP REST access) via the [ONTAP Expert Mode Tools](#ontap-expert-mode-tools). ONTAP mode requires `serviceLevel: FLEX` and `storagePoolType: UNIFIED`.

### Volume Tools

| Tool                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `gcnv_volume_create` | Create a volume (NFS, SMB, or iSCSI)                                        |
| `gcnv_volume_get`    | Get volume details including mount points                                   |
| `gcnv_volume_list`   | List volumes with pagination and filtering                                  |
| `gcnv_volume_update` | Update capacity, description, labels, export policy, tiering, backup config |
| `gcnv_volume_delete` | Delete a volume                                                             |

**iSCSI notes:** Protocols must be `["ISCSI"]` only (no mixing). Requires `hostGroup` or `hostGroups`. Optional `blockDevice` object with `identifier`, `osType` (`LINUX` / `WINDOWS` / `ESXI`), and `sizeGib`.

**Large capacity volumes:** Some workloads require larger volumes and higher throughput, which can be achieved by using the large capacity volume option for these service levels. Large capacity volumes provide six storage endpoints (IP addresses) to load-balance client traffic to the volume and deliver higher performance.

- **FLEX Unified:** Large capacity volumes can be sized between **4.8 TiB** and **2.48 PiB**, or up to **20 PiB** with auto-tiering, in increments of **1 GiB**, and deliver throughput performance of up to **22 GiBps**. The FLEX storage pool must be created with `scaleType: SCALE_TYPE_SCALEOUT`; non-scale-out FLEX pools cannot host large capacity volumes. When `largeCapacityConstituentCount` is **explicitly set**, the minimum drops to **2.4 TiB (2,400 GiB)** — FLEX Unified only. When `largeCapacityConstituentCount` is omitted, the **4.8 TiB (4,916 GiB)** floor applies.
- **Premium and Extreme:** Large capacity volumes can be sized between **15 TiB** and **3 PiB** in increments of **1 GiB**, and deliver throughput performance of up to **30 GiBps**.

A large capacity volume is internally composed of several **constituent volumes** (FlexVols) distributed across the pool's storage aggregates. On `gcnv_volume_create` you can optionally pass `largeCapacityConstituentCount` to control how many constituents the volume is built from:

- **Minimum:** `2`.
- **Default (when omitted):** chosen by the backend based on the active deployment layout.
- The constituent count **must be chosen at create time** and cannot be changed later.

**SMB attributes:** When `protocols` includes `SMB`, `gcnv_volume_create` accepts optional SMB feature flags that map to the `smbSettings` field on the volume:

- `smbEncryptData: true` → `ENCRYPT_DATA` (require SMB encryption in flight)
- `smbHideShare: true` → `NON_BROWSABLE` (hide the share from browse lists)
- `smbAccessBasedEnumeration: true` → `ACCESS_BASED_ENUMERATION` (ABE) — controls the visibility of files and folders based on the permissions assigned to the user
- `smbContinuouslyAvailable: true` → `CONTINUOUSLY_AVAILABLE` (CA share for SQL Server / FSLogix; choice is permanent on the volume)
- `smbSettings: ["OPLOCKS", ...]` — additional API enum values; merged with the booleans above. Do not pass `SMB_SETTINGS_UNSPECIFIED`; `BROWSABLE` and `NON_BROWSABLE` (or `BROWSABLE` together with `smbHideShare`) are rejected. `NON_BROWSABLE` and `CONTINUOUSLY_AVAILABLE` together (or `smbHideShare` with `smbContinuouslyAvailable`) are also rejected — CA shares must be browsable.

These flags require `protocols` to include `SMB`. `CONTINUOUSLY_AVAILABLE` is **not supported on `FLEX` storage pools** — the request is rejected before reaching the API. Use `STANDARD`, `PREMIUM`, or `EXTREME` for CA shares.

### Snapshot Tools

| Tool                   | Description                           |
| ---------------------- | ------------------------------------- |
| `gcnv_snapshot_create` | Create a snapshot of a volume         |
| `gcnv_snapshot_get`    | Get snapshot details                  |
| `gcnv_snapshot_list`   | List snapshots for a volume           |
| `gcnv_snapshot_update` | Update snapshot description or labels |
| `gcnv_snapshot_delete` | Delete a snapshot                     |
| `gcnv_snapshot_revert` | Revert a volume to a snapshot         |

### Backup Vault Tools

| Tool                       | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `gcnv_backup_vault_create` | Create a backup vault (with optional retention policy) |
| `gcnv_backup_vault_get`    | Get backup vault details                               |
| `gcnv_backup_vault_list`   | List backup vaults                                     |
| `gcnv_backup_vault_update` | Update description, labels, or retention policy        |
| `gcnv_backup_vault_delete` | Delete a backup vault                                  |

### Backup Tools

| Tool                        | Description                               |
| --------------------------- | ----------------------------------------- |
| `gcnv_backup_create`        | Create a backup from a volume or snapshot |
| `gcnv_backup_get`           | Get backup details                        |
| `gcnv_backup_list`          | List backups in a vault                   |
| `gcnv_backup_update`        | Update backup description or labels       |
| `gcnv_backup_delete`        | Delete a backup                           |
| `gcnv_backup_restore`       | Restore a backup to a volume              |
| `gcnv_backup_restore_files` | Restore specific files from a backup      |

### Backup Policy Tools

| Tool                        | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `gcnv_backup_policy_create` | Create a backup policy with daily/weekly/monthly limits |
| `gcnv_backup_policy_get`    | Get backup policy details                               |
| `gcnv_backup_policy_list`   | List backup policies                                    |
| `gcnv_backup_policy_update` | Update backup policy settings                           |
| `gcnv_backup_policy_delete` | Delete a backup policy                                  |

### Replication Tools

| Tool                                 | Description                                    |
| ------------------------------------ | ---------------------------------------------- |
| `gcnv_replication_create`            | Create a volume replication                    |
| `gcnv_replication_get`               | Get replication details                        |
| `gcnv_replication_list`              | List replications                              |
| `gcnv_replication_update`            | Update replication settings                    |
| `gcnv_replication_delete`            | Delete a replication                           |
| `gcnv_replication_stop`              | Stop an active replication                     |
| `gcnv_replication_resume`            | Resume a stopped replication                   |
| `gcnv_replication_reverse_direction` | Reverse replication direction                  |
| `gcnv_replication_sync`              | Trigger an on-demand replication sync          |
| `gcnv_replication_establish_peering` | Establish peering for cross-region replication |

Replication is supported between specific region pairs (Standard/Premium/Extreme) or within the same region group (Flex). See the [replication guide](https://cloud.google.com/netapp/volumes/docs/protect-data/about-volume-replication).

### Active Directory Tools

| Tool                           | Description                              |
| ------------------------------ | ---------------------------------------- |
| `gcnv_active_directory_create` | Create an Active Directory configuration |
| `gcnv_active_directory_get`    | Get Active Directory details             |
| `gcnv_active_directory_list`   | List Active Directory configurations     |
| `gcnv_active_directory_update` | Update Active Directory settings         |
| `gcnv_active_directory_delete` | Delete an Active Directory configuration |

### KMS Config Tools

| Tool                              | Description                       |
| --------------------------------- | --------------------------------- |
| `gcnv_kms_config_create`          | Create a KMS configuration        |
| `gcnv_kms_config_get`             | Get KMS config details            |
| `gcnv_kms_config_list`            | List KMS configurations           |
| `gcnv_kms_config_update`          | Update KMS config settings        |
| `gcnv_kms_config_delete`          | Delete a KMS configuration        |
| `gcnv_kms_config_verify`          | Verify a KMS configuration        |
| `gcnv_kms_config_encrypt_volumes` | Encrypt volumes with a KMS config |

### Quota Rule Tools

| Tool                     | Description                      |
| ------------------------ | -------------------------------- |
| `gcnv_quota_rule_create` | Create a quota rule for a volume |
| `gcnv_quota_rule_get`    | Get quota rule details           |
| `gcnv_quota_rule_list`   | List quota rules                 |
| `gcnv_quota_rule_update` | Update a quota rule              |
| `gcnv_quota_rule_delete` | Delete a quota rule              |

### Host Group Tools

| Tool                     | Description                                 |
| ------------------------ | ------------------------------------------- |
| `gcnv_host_group_create` | Create a host group (iSCSI initiator group) |
| `gcnv_host_group_get`    | Get host group details                      |
| `gcnv_host_group_list`   | List host groups                            |
| `gcnv_host_group_update` | Update a host group                         |
| `gcnv_host_group_delete` | Delete a host group                         |

### Operation Tools

| Tool                    | Description                                   |
| ----------------------- | --------------------------------------------- |
| `gcnv_operation_get`    | Get details of a long-running operation       |
| `gcnv_operation_list`   | List operations with filtering and pagination |
| `gcnv_operation_cancel` | Cancel an in-progress operation               |

### Logs, Errors & Events Tools

These read-only tools query [Google Cloud Logging](https://cloud.google.com/netapp/volumes/docs/monitor/cloud-logging) scoped to the NetApp service (`protoPayload.serviceName="netapp.googleapis.com"`). They build the Cloud Logging filter internally from high-level arguments, so callers do not need to know the filter DSL. All accept `projectId` (required) plus optional `location`, `resourceType`, `resourceName`, `startTime`/`endTime` (RFC3339, default last 24h), `pageSize` (default 50, max 200), `pageToken`, and `orderBy`.

| Tool               | Description                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `gcnv_logs_list`   | List log entries; optional `severity` (minimum) and `freeTextFilter` (validated raw filter clause)  |
| `gcnv_errors_list` | List failures (`severity>=ERROR` or non-zero operation status); optional `minSeverity` override     |
| `gcnv_events_list` | List lifecycle/admin-activity events; optional `eventType` and `methodName` (supports `*` wildcard) |
| `gcnv_log_summary` | Scan a window and return aggregated counts by severity, method, and resource, plus a failure count  |

**Authentication:** these tools reuse the same Google Cloud credentials as the rest of the server (ADC / `GOOGLE_APPLICATION_CREDENTIALS`). The principal needs `roles/logging.viewer` (`logging.logEntries.list`). Admin Activity audit logs are always available; [Data Access audit logs](https://cloud.google.com/logging/docs/audit/configure-data-access) must be explicitly enabled to see read-type entries.

### ONTAP Expert Mode Tools

ONTAP Expert Mode is available for storage pools created with `mode: ONTAP`. It exposes supported ONTAP REST operations through the MCP server while still using Google Cloud authentication and the GCNV control plane proxy. No separate ONTAP credentials or direct ONTAP endpoint configuration are required.

| Tool               | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `ontap_discover`   | Search the bundled ONTAP REST index by resource or intent           |
| `ontap_execute`    | Execute a discovered ONTAP REST endpoint                            |
| `ontap_audit_log`  | Enable or disable local Markdown audit logging for ONTAP tool calls |
| `ontap_job_get`    | Poll an ONTAP async job until success or failure                    |
| `ontap_svm_list`   | List ONTAP SVM details for a pool                                   |
| `ontap_volume_*`   | Convenience tools for common ONTAP volume operations                |
| `ontap_snapshot_*` | Convenience tools for common ONTAP snapshot operations              |
| `ontap_lun_*`      | Convenience tools for common ONTAP LUN operations                   |

For advanced resources such as QoS policies, SnapMirror, export policies, CIFS services, igroups, snapshot policies, SnapLock, Event Based Retention, schedules, and cluster/SVM peering, use `ontap_discover` first and then call `ontap_execute` with the discovered method, path, and body template.

`ontap_discover` responses include descriptions, hints, example body templates, and generated `requiredBody` metadata when ONTAP swagger marks body fields as required. `ontap_execute` preflight-validates requests against the bundled API index (method, path, and required body fields) before calling ONTAP. Unlisted paths — including GET — are rejected with a `scope_denied` envelope; use `ontap_discover` to find supported endpoints. For POST/PATCH calls, pass the body as a JSON string.

ONTAP mutating operations commonly return async jobs. After create, update, delete, or replication actions, poll the returned job UUID with `ontap_job_get`; a returned job reference does not by itself mean the operation is complete.

Safety guardrails:

- ONTAP DELETE operations are preview-first. The first call returns a delete preview with the target `resourceName` (resolved via read-only GET). After explicit user approval, call again with `confirmDelete=true` and `confirmedResourceName` set to the exact name from the preview. Applies to `ontap_execute` DELETE and dedicated delete tools (`ontap_volume_delete`, `ontap_snapshot_delete`, `ontap_lun_delete`).
- Some endpoints are out of scope for this MCP server or blocked by the proxy/RBAC policy. These return a `scope_denied` envelope and should not be retried with sibling paths or private CLI variants.
- `/api/private/cli` subpaths are intentionally blocked at preflight. Use public `/api/...` endpoints from `ontap_discover` or dedicated tools instead.
- User-facing clients should redact sensitive fields before displaying tool output.

## Architecture

```
src/
  index.ts                          # Entry point (stdio + HTTP/SSE transports)
  logger.ts                         # Structured logging (pino)
  registry/
    register-tools.ts               # Tool registration
  resources/
    ontap-api-index.json            # Static ONTAP REST API catalog (powers ontap_discover)
  tools/
    *-tools.ts                      # Tool definitions (Zod schemas)
    ontap-*-tool.ts                 # ONTAP Expert Mode tool schemas
    handlers/
      *-handler.ts                  # Tool implementations
  types/
    tool.ts                         # Shared TypeScript interfaces
  utils/
    netapp-client-factory.ts        # NetApp client factory with caching
    logging-client-factory.ts       # @google-cloud/logging client factory (logs/errors/events)
    logging-filter.ts               # Builds Cloud Logging filters scoped to GCNV
    ontap-http-client.ts            # ONTAP REST client (auth, body envelope, response unwrapping)
    ontap-index-loader.ts           # Loads and indexes the ONTAP API catalog
    ontap-preflight-validator.ts    # Pre-execution validation (index allowlist, CLI block, required body)
    ontap-delete-preview.ts         # DELETE preview / confirmation guardrail
    ontap-response-utils.ts         # ONTAP response shaping and error helpers
    ontap-audit-logger.ts           # Optional Markdown audit log for ONTAP tool calls
    scope-denied-envelope.ts        # Proxy/RBAC scope denial envelope
```

## Troubleshooting

**`ontap_execute` returns `scope_denied: ONTAP API index could not be loaded ...`** — the bundled API index file is missing or unreadable, usually from an incomplete install. Re-add `gcnv-mcp-server` in your MCP client to trigger a fresh `npx` download; if that doesn't help, run `npm cache clean --force` and re-add. Persistent failures: file an issue at <https://github.com/NetApp/gcnv-mcp-server> with the server log.

## Development

### Build and test

```bash
npm install
npm run build          # lint + format + compile
npm test               # run all tests
npm run test:coverage  # with coverage report
npm run sbom           # print an SPDX SBOM
```

### Dev mode

```bash
npm run dev            # stdio via tsx
npm run dev:http       # HTTP via tsx
```

### Adding a new tool

1. Define the tool schema in `src/tools/<resource>-tools.ts`
2. Implement the handler in `src/tools/handlers/<resource>-handler.ts`
3. Register the tool in `src/registry/register-tools.ts`

### Pre-commit hook

```bash
npm run githooks:install   # enables lint + test on commit
```

## Billing

Pricing is based on provisioned pool capacity, not consumed capacity. Some features (e.g. auto-tiering) add usage-based I/O charges. See the [pricing page](https://cloud.google.com/netapp/volumes/pricing?hl=en) or use the Google Cloud Pricing Calculator for estimates.

## License

Apache-2.0

## Feedback

We'd love to hear from you. Share feedback, feature requests, or bug reports at [ng-gcnv-mcp-feedback@netapp.com](mailto:ng-gcnv-mcp-feedback@netapp.com).

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.
