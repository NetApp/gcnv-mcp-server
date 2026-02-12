# Google Cloud NetApp Volumes MCP Server

This is a Model Context Protocol (MCP) server for managing Google Cloud NetApp Volumes (GCNV) resources. It provides tools for managing storage pools, volumes, snapshots, backups (including file-level restore), backup vaults, backup policies, replications, Active Directory, KMS configs, quota rules, host groups, and long-running operations.

## Overview

The Google Cloud NetApp Volumes MCP Server is built using the Model Context Protocol SDK and provides a set of tools for interacting with Google Cloud NetApp Volumes resources. It supports operations for Storage Pool management, Volume management, and long-running operations management.

## Features

- **Storage Pool Management**:
  - Create new storage pools with configurable capacity, service level, and network settings
  - List storage pools with pagination and filtering
  - Get detailed information about specific storage pools
  - Update storage pool properties (capacity, description, labels)
  - Delete storage pools

- **Volume Management**:
  - Create new volumes within storage pools with configurable capacity and protocols
  - List volumes with pagination and filtering
  - Get detailed information about specific volumes, including mount points
  - Update volume properties (capacity, description, labels, export policy)
  - Delete volumes

- **Snapshot Management**:
  - Create new snapshots for volumes
  - List snapshots for a specific volume
  - Get detailed information about specific snapshots
  - Delete snapshots when they are no longer needed
  - Revert volumes to previous snapshots

- **Backup Vault Management**:
  - Create new backup vaults for storing backups
  - List backup vaults with pagination and filtering
  - Get detailed information about specific backup vaults
  - Update backup vault properties (description, labels)
  - Delete backup vaults when they are no longer needed

- **Backup Management**:
  - Create new backups of volumes in backup vaults
  - List backups in a specific backup vault
  - Get detailed information about specific backups
  - Delete backups when they are no longer needed
  - Restore backups to new or existing volumes
  - Restore specific files from a backup into an existing volume

- **Host Group Management**:
  - Create, list, get, update, and delete host groups (iSCSI initiator groups)

- **Replication Management**:
  - Create, list, get, update, stop, resume, reverse direction, sync, and establish peering for replications
  - Replication is only supported between specific region pairs for Standard/Premium/Extreme, or within the same region group for Flex. Always validate the requested source/destination regions against the official matrix before creating a replication. See [the Google Cloud NetApp Volumes replication guide](https://docs.cloud.google.com/netapp/volumes/docs/protect-data/about-volume-replication).
  - When creating a replication, the destination volume is auto-created by specifying only the destination storage pool. Users can also choose a replication schedule (`EVERY_10_MINUTES`, `HOURLY`, or `DAILY`; defaults to `HOURLY`).

- **Long-running Operations Management**:
  - Get details of an operation by ID
  - Cancel in-progress operations
  - List operations with filtering and pagination

## Prerequisites

- Node.js 18 or higher
- Google Cloud project with NetApp Volumes API enabled
- Google Cloud authentication credentials

## Installation

If you just want to run the published package (no local build), use:

```bash
npx @netapp/gcnv-mcp-server@latest --transport stdio
```

Then configure `gemini-extension.json` (or your linked extension) to call the same command. To work from source, follow the steps below.

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd GCNV-MCP-SERVER
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project (required when working from source or before publishing):

   ```bash
   npm run build
   ```

4. Link the Gemini extension so the CLI can launch the MCP server over stdio:

   ```bash
   gemini extension link .
   ```

5. Confirm the extension is registered and ready. The MCP server should appear in the list:

   ```bash
   gemini mcp list
   ```

> Gemini automatically forks the MCP server whenever a linked extension needs it, so once the build output exists (or the published package is available via `npx`) and the extension is linked, no manual `npm start` is required for normal usage.

## Google Cloud Authentication

Ensure you have valid Google Cloud credentials set up before invoking tools:

- Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to a service account key file, or
- Use Application Default Credentials (ADC) with `gcloud auth application-default login`

## Usage

### Starting the Server

The MCP server supports both **stdio** (default) and **HTTP/SSE** transports. The transport mode can be controlled via command-line flags.

#### Stdio Transport (Default)

The stdio transport is the default mode and is launched by Gemini CLI when a linked extension requires it.

- After running `gemini extension link .`, you can verify that Gemini sees the server with `gemini mcp list`.
- Trigger any MCP interaction from Gemini (for example, invoke a registered tool) and the CLI will spawn the `gcnv-mcp` process automatically.
- For manual debugging you can run `npm start` or `npm run start:stdio`, which starts the stdio transport and waits for a client connection on stdin/stdout.

#### HTTP/SSE Transport

The server can also run as an HTTP server using Server-Sent Events (SSE) for MCP communication.

**Basic Usage:**

```bash
# Start HTTP server on default port 3000
npm run start:http

# Or with explicit transport flag
npm start -- --transport http

# Start HTTP server on custom port
npm start -- --transport http --port 8080

# Short form
npm start -- -t http -p 8080
```

**Command-Line Options:**

- `--transport` or `-t`: Transport mode (`stdio` or `http`). Default: `stdio`
- `--port` or `-p`: HTTP server port (only used with HTTP transport). Default: `3000`

**HTTP Endpoint:**
When running in HTTP mode, the server listens on:

- `http://localhost:<port>/message` - SSE endpoint for MCP communication

**Development Mode:**

```bash
# Build and start with stdio (default)
npm run dev

# Build and start with HTTP transport
npm run dev:http
```

### Available Tools

The server exposes the following tools through the MCP interface:

#### Storage Pool Tools

##### Service levels (Flex vs Standard/Premium/Extreme)

When you create a storage pool you must choose a `serviceLevel`. In simple terms:

- **FLEX**: The newest option. Designed for more flexibility (smaller minimum sizes and, in some regions, the ability to scale performance more independently). Also available in many more regions than the classic tiers.
- **STANDARD / PREMIUM / EXTREME**: The “classic” tiers. Performance scales in a fixed way with provisioned capacity; Premium/Extreme are higher-performance tiers than Standard.

Notes:

- **Availability varies by region**. Always check the latest docs for your target region.
- **This MCP server accepts `serviceLevel` case-insensitively** for pool creation (for example `flex` or `FLEX`).
- **Minimum storage pool capacity (this project’s guidance)**:
  - **FLEX**:
    - `FILE` / `UNIFIED`: **1024 GiB**
    - `UNIFIED_LARGE_CAPACITY`: **6 TiB (6144 GiB)**
  - **STANDARD / PREMIUM / EXTREME**: **2048 GiB**
- **FLEX location rules**:
  - If `location` is a **zone** (for example `us-central1-a`), that satisfies “zone in location” for FLEX pools and you **do not** need to send `zone`/`replicaZone` in the request body.
  - If `location` is a **region** (for example `us-central1`), then FLEX pool creation requires both `zone` and `replicaZone`.
- **StoragePoolType (FLEX-only new types)**:
  - `storagePoolType` supports `FILE | UNIFIED | UNIFIED_LARGE_CAPACITY` (plus `..._UNSPECIFIED`).
  - `UNIFIED` and `UNIFIED_LARGE_CAPACITY` are only available for **FLEX** service level.

References:

- NetApp announcement: `https://www.netapp.com/product-updates/gcnv-flex-service-level-forty-regions/`
- Google Cloud service levels overview: `https://cloud.google.com/netapp/volumes/docs/discover/service-levels`
- Manual QoS (Google Cloud docs): `https://docs.cloud.google.com/netapp/volumes/docs/performance/optimize-performance#set_up_manual_qos_limits`

1. **gcnv_storage_pool_create** - Create a new storage pool
   - Inputs: projectId, location, storagePoolId, capacityGib, serviceLevel (`FLEX|STANDARD|PREMIUM|EXTREME`), description (optional), labels (optional), network (optional), activeDirectory (optional), kmsConfig (optional), encryptionType (optional), ldapEnabled (optional), totalThroughputMibps (optional; FLEX custom performance only), qosType (`AUTO|MANUAL`, optional; MANUAL is not supported for FLEX), allowAutoTiering (optional), storagePoolType (optional; `UNIFIED*` is FLEX-only), zone (optional; required for FLEX when location is a region), replicaZone (optional; required for FLEX when location is a region)

2. **gcnv_storage_pool_delete** - Delete an existing storage pool
   - Inputs: projectId, location, storagePoolId, force (optional)

3. **gcnv_storage_pool_get** - Get details about a specific storage pool
   - Inputs: projectId, location, storagePoolId

4. **gcnv_storage_pool_list** - List all storage pools in a project/location
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_storage_pool_update** - Update a storage pool's properties
   - Inputs: projectId, location, storagePoolId, capacityGib (optional), description (optional), labels (optional), qosType (`AUTO|MANUAL`, optional; MANUAL is not supported for FLEX), storagePoolType (optional; `UNIFIED*` is FLEX-only), zone (optional), replicaZone (optional)

6. **gcnv_storage_pool_validate_directory_service** - Validate directory service policy attached to a storage pool
   - Inputs: projectId, location, storagePoolId, directoryServiceType (`ACTIVE_DIRECTORY|LDAP`)

#### Operation Tools

1. **gcnv_operation_get** - Get details of a long-running operation
   - Inputs: operationName (the full name of the operation)

2. **gcnv_operation_cancel** - Cancel an in-progress operation
   - Inputs: operationName (the full name of the operation)

3. **gcnv_operation_list** - List operations in a project/location
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

#### Volume Tools

1. **gcnv_volume_create** - Create a new volume in a storage pool
   - Inputs: projectId, location, storagePoolId, volumeId, capacityGib, protocols (`NFSV3|NFSV4|SMB|ISCSI`), description (optional), shareName (optional), labels (optional), backupConfig (optional), snapshotPolicy (optional; scheduled snapshots: hourly/daily/weekly/monthly), tieringPolicy (optional; auto-tiering), hybridReplicationParameters (optional; hybrid replication), exportPolicy (optional), throughputMibps (optional; manual QoS volume throughput limit), largeCapacity (optional; Premium/Extreme only; requires >= 15 TiB), multipleEndpoints (optional; only with largeCapacity)
   - iSCSI specifics:
     - Set `protocols: ["ISCSI"]` (iSCSI cannot be combined with NFS/SMB protocols)
     - Provide **either** `hostGroup` (single) **or** `hostGroups` (array). Values can be IDs (`hg1`) or fully-qualified names (`projects/.../locations/.../hostGroups/hg1`).
     - Optional `blockDevice` object: `{ identifier?, sizeGib?, osType? }` where `osType` is `LINUX|WINDOWS|ESXI|OS_TYPE_UNSPECIFIED`.

   Example (iSCSI volume create):

   ```json
   {
     "projectId": "p1",
     "location": "us-central1",
     "storagePoolId": "projects/p1/locations/us-central1/storagePools/sp1",
     "volumeId": "vol-iscsi",
     "capacityGib": 100,
     "protocols": ["ISCSI"],
     "hostGroup": "hg1",
     "blockDevice": { "identifier": "lun0", "osType": "LINUX", "sizeGib": 100 }
   }
   ```

2. **gcnv_volume_delete** - Delete an existing volume
   - Inputs: projectId, location, volumeId, force (optional)

3. **gcnv_volume_get** - Get details about a specific volume
   - Inputs: projectId, location, volumeId

4. **gcnv_volume_list** - List all volumes in a storage pool
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_volume_update** - Update a volume's properties
   - Inputs: projectId, location, volumeId, capacityGib (optional), description (optional), labels (optional), backupConfig (optional), tieringPolicy (optional; auto-tiering), hybridReplicationParameters (optional; hybrid replication), exportPolicy (optional), throughputMibps (optional)

#### Snapshot Tools

1. **gcnv_snapshot_create** - Create a new snapshot of a volume
   - Inputs: projectId, location, volumeId, snapshotId, description (optional), labels (optional)

2. **gcnv_snapshot_delete** - Delete an existing snapshot
   - Inputs: projectId, location, volumeId, snapshotId

3. **gcnv_snapshot_get** - Get details about a specific snapshot
   - Inputs: projectId, location, volumeId, snapshotId

4. **gcnv_snapshot_list** - List all snapshots for a volume
   - Inputs: projectId, location, volumeId, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_snapshot_revert** - Revert a volume to a specific snapshot
   - Inputs: projectId, location, volumeId, snapshotId

6. **gcnv_snapshot_update** - Update a snapshot
   - Inputs: projectId, location, volumeId, snapshotId, description (optional), labels (optional)

#### Backup Vault Tools

1. **gcnv_backup_vault_create** - Create a new backup vault
   - Inputs: projectId, location, backupVaultId, description (optional), backupRetentionPolicy (optional; includes immutability flags), labels (optional)

2. **gcnv_backup_vault_delete** - Delete an existing backup vault
   - Inputs: projectId, location, backupVaultId, force (optional)

3. **gcnv_backup_vault_get** - Get details about a specific backup vault
   - Inputs: projectId, location, backupVaultId

4. **gcnv_backup_vault_list** - List all backup vaults in a project and location
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_backup_vault_update** - Update a backup vault's properties
   - Inputs: projectId, location, backupVaultId, description (optional), backupRetentionPolicy (optional; includes immutability flags), labels (optional)

#### Backup Tools

1. **gcnv_backup_create** - Create a new backup of a volume
   - Inputs: projectId, location, backupVaultId, backupId, sourceVolumeName (optional; provide exactly one of sourceVolumeName or sourceSnapshotName), sourceSnapshotName (optional), backupRegion (optional), description (optional), labels (optional)

2. **gcnv_backup_delete** - Delete an existing backup
   - Inputs: projectId, location, backupVaultId, backupId

3. **gcnv_backup_get** - Get details about a specific backup
   - Inputs: projectId, location, backupVaultId, backupId

4. **gcnv_backup_list** - List all backups in a backup vault
   - Inputs: projectId, location, backupVaultId, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_backup_restore** - Restore a backup to a new or existing volume
   - Inputs: projectId, location, backupVaultId, backupId, targetStoragePoolId, targetVolumeId, restoreOption

6. **gcnv_backup_restore_files** - Restore specific files from a backup into a destination volume
   - Inputs: projectId, location, volumeId (destination), backupVaultId, backupId, fileList (absolute paths in source volume), restoreDestinationPath (absolute directory path in destination volume)

7. **gcnv_backup_update** - Update a backup
   - Inputs: projectId, location, backupVaultId, backupId, description (optional), labels (optional)

#### Backup Policy Tools

1. **gcnv_backup_policy_create** - Create a backup policy
   - Inputs: projectId, location, backupPolicyId, dailyBackupLimit (optional), weeklyBackupLimit (optional), monthlyBackupLimit (optional), enabled (optional), description (optional), labels (optional)

2. **gcnv_backup_policy_delete** - Delete a backup policy
   - Inputs: projectId, location, backupPolicyId, force (optional)

3. **gcnv_backup_policy_get** - Get a backup policy
   - Inputs: projectId, location, backupPolicyId

4. **gcnv_backup_policy_list** - List backup policies
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_backup_policy_update** - Update a backup policy
   - Inputs: projectId, location, backupPolicyId, dailyBackupLimit (optional), weeklyBackupLimit (optional), monthlyBackupLimit (optional), enabled (optional), description (optional), labels (optional)

#### Replication Tools

- `gcnv_replication_create`, `gcnv_replication_delete`, `gcnv_replication_get`, `gcnv_replication_list`, `gcnv_replication_update`
- `gcnv_replication_resume`, `gcnv_replication_stop`, `gcnv_replication_reverse_direction`
- `gcnv_replication_establish_peering`, `gcnv_replication_sync`

#### Active Directory Tools

- `gcnv_active_directory_create`, `gcnv_active_directory_delete`, `gcnv_active_directory_get`, `gcnv_active_directory_list`, `gcnv_active_directory_update`

#### KMS Config Tools

- `gcnv_kms_config_create`, `gcnv_kms_config_delete`, `gcnv_kms_config_get`, `gcnv_kms_config_list`, `gcnv_kms_config_update`
- `gcnv_kms_config_verify`, `gcnv_kms_config_encrypt_volumes`

#### Quota Rule Tools

- `gcnv_quota_rule_create`, `gcnv_quota_rule_delete`, `gcnv_quota_rule_get`, `gcnv_quota_rule_list`, `gcnv_quota_rule_update`

#### Host Group Tools

- `gcnv_host_group_create`, `gcnv_host_group_delete`, `gcnv_host_group_get`, `gcnv_host_group_list`, `gcnv_host_group_update`

## Architecture

The project follows a modular architecture:

- **Server**: MCP server supporting both stdio and HTTP/SSE transports
  - **Stdio Transport**: Default mode, links directly with Gemini CLI and other stdio-based MCP clients
  - **HTTP/SSE Transport**: HTTP server mode for web-based MCP clients and remote access
- **Tools**: Defined using Zod schemas for input validation
- **Handlers**: Implementation for each tool's functionality
- **Factory Pattern**: Uses a factory for managing NetApp client instances with caching

## Integrating with Chat AI Applications (e.g., Gemini)

To use the MCP server with Gemini CLI or other MCP-aware clients:

1. **Link the Extension**  
   After building the project from source (or when relying on the published package via `npx @netapp/gcnv-mcp-server@latest`), register the extension with the Gemini CLI. This enables Gemini to fork the stdio-based server on demand.

   ```bash
   gemini extension link .
   ```

2. **(Optional) Customize the Extension**  
   Edit `gemini-extension.json` if you need to pass environment variables or adjust the command/arguments that Gemini executes when launching the MCP server.

3. **Verify the Registration**  
   Confirm that Gemini recognizes the MCP server:

   ```bash
   gemini mcp list
   ```

4. **Invoke Tools via Chat**  
   Trigger MCP interactions from Gemini. When a chat session or CLI command references the `gcnv-mcp` server, Gemini starts the `gcnv-mcp` CLI (from the published package via `npx`, or from your local `build/index.js` when linked from source) and communicates with it over stdio (default).
   No extra launch step is necessary—the CLI takes care of process lifecycle each time the server is needed.

   **Note**: For HTTP transport mode, you'll need to manually start the server and configure your MCP client to connect to the HTTP endpoint instead of using stdio.

5. **Maintain Authentication**  
   Ensure the MCP process has access to Google Cloud credentials as outlined in the prerequisites.

For other chat AI applications, follow their documentation for linking stdio-based MCP servers; most can reuse the `gemini-extension.json` structure as a template.

### Key Components

- `src/index.ts` - Main server setup and entry point
- `src/registry/register-tools.ts` - Tool registration
- `src/tools/storage-pool-tools.ts` - Storage pool tool definitions with schemas
- `src/tools/volume-tools.ts` - Volume tool definitions with schemas
- `src/tools/snapshot-tools.ts` - Snapshot tool definitions with schemas
- `src/tools/operation-tools.ts` - Operation tool definitions with schemas
- `src/tools/backup-vault-tools.ts` - Backup vault tool definitions with schemas
- `src/tools/backup-tools.ts` - Backup tool definitions with schemas
- `src/tools/host-group-tools.ts` - Host group tool definitions with schemas
- `src/tools/handlers/storage-pool-handler.ts` - Storage pool tool implementation
- `src/tools/handlers/volume-handler.ts` - Volume tool implementation
- `src/tools/handlers/snapshot-handler.ts` - Snapshot tool implementation
- `src/tools/handlers/operation-handler.ts` - Operation tool implementation
- `src/tools/handlers/backup-vault-handler.ts` - Backup vault tool implementation
- `src/tools/handlers/backup-handler.ts` - Backup tool implementation
- `src/tools/handlers/host-group-handler.ts` - Host group tool implementation
- `src/utils/netapp-client-factory.ts` - Factory for NetApp client creation

## Development

### Adding New Tools

1. Define the tool schema in a new or existing file in the `src/tools` directory
2. Implement the handler in the `src/tools/handlers` directory
3. Register the tool in `src/registry/register-tools.ts`

### Pre-commit hook (lint + unit tests)

This repo includes a Git pre-commit hook in `.githooks/pre-commit` that runs:

- `npm run lint`
- `npm test`

To enable it locally:

```bash
npm run githooks:install
```

### Project Structure

```plaintext
src/
  ├── index.ts               # Main entry point
  ├── registry/
  │   └── register-tools.ts  # Tool registration
  ├── tools/
  │   ├── storage-pool-tools.ts       # Storage pool tool definitions
  │   ├── volume-tools.ts            # Volume tool definitions
  │   ├── snapshot-tools.ts          # Snapshot tool definitions
  │   ├── operation-tools.ts         # Operation tool definitions
  │   ├── backup-vault-tools.ts      # Backup vault tool definitions
  │   ├── backup-tools.ts            # Backup tool definitions
  │   └── handlers/
  │       ├── storage-pool-handler.ts # Storage pool tool handlers
  │       ├── volume-handler.ts      # Volume tool handlers
  │       ├── snapshot-handler.ts    # Snapshot tool handlers
  │       ├── operation-handler.ts   # Operation tool handlers
  │       ├── backup-vault-handler.ts # Backup vault tool handlers
  │       └── backup-handler.ts      # Backup tool handlers
  ├── types/
  │   └── tool.ts            # TypeScript interfaces
  └── utils/
      └── netapp-client-factory.ts    # NetApp client factory
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server implementation
- `@google-cloud/netapp` - Google Cloud NetApp Volumes client library
- `zod` - Schema validation library

## License

Apache-2.0

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
