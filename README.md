# Google Cloud NetApp Volumes MCP Server

## ⚠️ Preview

**This project is under active development. APIs, tool schemas, and behavior may change without notice. Not recommended for production use.**

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for managing [Google Cloud NetApp Volumes](https://cloud.google.com/netapp/volumes/docs) (GCNV) resources through AI assistants such as Gemini CLI, Cursor, and other MCP-compatible clients.

## Supported Resources

| Resource             | Operations                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **Storage Pools**    | create, get, list, update, delete, validate directory service                               |
| **Volumes**          | create, get, list, update, delete                                                           |
| **Snapshots**        | create, get, list, update, delete, revert                                                   |
| **Backup Vaults**    | create, get, list, update, delete                                                           |
| **Backups**          | create, get, list, update, delete, restore, restore files                                   |
| **Backup Policies**  | create, get, list, update, delete                                                           |
| **Replications**     | create, get, list, update, delete, stop, resume, reverse direction, sync, establish peering |
| **Active Directory** | create, get, list, update, delete                                                           |
| **KMS Configs**      | create, get, list, update, delete, verify, encrypt volumes                                  |
| **Quota Rules**      | create, get, list, update, delete                                                           |
| **Host Groups**      | create, get, list, update, delete                                                           |
| **Operations**       | get, list, cancel                                                                           |

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

- **FLEX** -- Smaller minimums, broader region availability, independent performance scaling. Minimum: 1024 GiB (FILE/UNIFIED) or 6144 GiB (UNIFIED_LARGE_CAPACITY).
- **STANDARD / PREMIUM / EXTREME** -- Classic tiers with fixed performance-to-capacity ratio. Minimum: 2048 GiB.
- `serviceLevel` is accepted case-insensitively (e.g. `flex` or `FLEX`).
- FLEX pools in a region-level location require both `zone` and `replicaZone`; zone-level locations satisfy this automatically.

### Volume Tools

| Tool                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `gcnv_volume_create` | Create a volume (NFS, SMB, or iSCSI)                                        |
| `gcnv_volume_get`    | Get volume details including mount points                                   |
| `gcnv_volume_list`   | List volumes with pagination and filtering                                  |
| `gcnv_volume_update` | Update capacity, description, labels, export policy, tiering, backup config |
| `gcnv_volume_delete` | Delete a volume                                                             |

**iSCSI notes:** Protocols must be `["ISCSI"]` only (no mixing). Requires `hostGroup` or `hostGroups`. Optional `blockDevice` object with `identifier`, `osType` (`LINUX` / `WINDOWS` / `ESXI`), and `sizeGib`.

**Large capacity volumes:** Set `largeCapacity: true` (Premium/Extreme only, minimum 15 TiB). Optional `multipleEndpoints: true`.

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

## Architecture

```
src/
  index.ts                          # Entry point (stdio + HTTP/SSE transports)
  logger.ts                         # Structured logging (pino)
  registry/
    register-tools.ts               # Tool registration
  tools/
    *-tools.ts                      # Tool definitions (Zod schemas)
    handlers/
      *-handler.ts                  # Tool implementations
  types/
    tool.ts                         # Shared TypeScript interfaces
  utils/
    netapp-client-factory.ts        # NetApp client factory with caching
```

## Development

### Build and test

```bash
npm install
npm run build          # lint + format + compile
npm test               # run all tests
npm run test:coverage  # with coverage report
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
