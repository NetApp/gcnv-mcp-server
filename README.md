# Google Cloud NetApp Volumes MCP Server

This is a Model Context Protocol (MCP) server for managing Google Cloud NetApp Volumes resources. It provides a set of tools for creating, retrieving, listing, updating, and deleting storage pools in Google Cloud NetApp Volumes.

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

- **Replication Management**:
  - Create, list, get, update, stop, resume, reverse direction, sync, and establish peering for replications
  - Replication is only supported between specific region pairs for Standard/Premium/Extreme, or within the same region group for Flex. Always validate the requested source/destination regions against the official matrix before creating a replication. See the Google Cloud NetApp Volumes replication guide: https://docs.cloud.google.com/netapp/volumes/docs/protect-data/about-volume-replication
  - When creating a replication, the destination volume is auto-created by specifying only the destination storage pool. Users can also choose a replication schedule (`EVERY_10_MINUTES`, `HOURLY`, or `DAILY`; defaults to `HOURLY`).

- **Long-running Operations Management**:
  - Get details of an operation by ID
  - Cancel in-progress operations
  - List operations with filtering and pagination

## Prerequisites

- Node.js 16 or higher
- Google Cloud project with NetApp Volumes API enabled
- Google Cloud authentication credentials

## Installation

If you just want to run the published package (no local build), use:

```bash
npx @gcnv/gcnv-mcp-server@latest --transport stdio
```

Then configure `gemini-extension.json` (or your linked extension) to call the same command. To work from source, follow the steps below.

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd GCNV-MCP-LOCAL
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

1. **storage_pool_create** - Create a new storage pool
   - Inputs: projectId, location, storagePoolId, capacityGib, serviceLevel, description (optional), labels (optional), networkConfig (optional)

2. **storage_pool_delete** - Delete an existing storage pool
   - Inputs: projectId, location, storagePoolId, force (optional)

3. **storage_pool_get** - Get details about a specific storage pool
   - Inputs: projectId, location, storagePoolId

4. **storage_pool_list** - List all storage pools in a project/location
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

5. **storage_pool_update** - Update a storage pool's properties
   - Inputs: projectId, location, storagePoolId, capacityGib (optional), description (optional), labels (optional)

#### Operation Tools

1. **operation_get** - Get details of a long-running operation
   - Inputs: operationName (the full name of the operation)

2. **operation_cancel** - Cancel an in-progress operation
   - Inputs: operationName (the full name of the operation)

3. **operation_list** - List operations in a project/location
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

#### Volume Tools

1. **volume_create** - Create a new volume in a storage pool
   - Inputs: projectId, location, storagePoolId, volumeId, capacityGib, shareProtocols, description (optional), labels (optional), exportPolicy (optional)

2. **volume_delete** - Delete an existing volume
   - Inputs: projectId, location, storagePoolId, volumeId, force (optional)

3. **volume_get** - Get details about a specific volume
   - Inputs: projectId, location, storagePoolId, volumeId

4. **volume_list** - List all volumes in a storage pool
   - Inputs: projectId, location, storagePoolId, filter (optional), pageSize (optional), pageToken (optional)

5. **volume_update** - Update a volume's properties
   - Inputs: projectId, location, storagePoolId, volumeId, capacityGib (optional), description (optional), labels (optional), exportPolicy (optional)

#### Snapshot Tools

1. **snapshot_create** - Create a new snapshot of a volume
   - Inputs: projectId, location, storagePoolId, volumeId, snapshotId, description (optional)

2. **snapshot_delete** - Delete an existing snapshot
   - Inputs: projectId, location, storagePoolId, volumeId, snapshotId

3. **snapshot_get** - Get details about a specific snapshot
   - Inputs: projectId, location, storagePoolId, volumeId, snapshotId

4. **snapshot_list** - List all snapshots for a volume
   - Inputs: projectId, location, storagePoolId, volumeId, filter (optional), pageSize (optional), pageToken (optional)

5. **snapshot_revert_volume** - Revert a volume to a specific snapshot
   - Inputs: projectId, location, storagePoolId, volumeId, snapshotId

#### Backup Vault Tools

1. **gcnv_backup_vault_create** - Create a new backup vault
   - Inputs: projectId, location, backupVaultId, description (optional), labels (optional)

2. **gcnv_backup_vault_delete** - Delete an existing backup vault
   - Inputs: projectId, location, backupVaultId, force (optional)

3. **gcnv_backup_vault_get** - Get details about a specific backup vault
   - Inputs: projectId, location, backupVaultId

4. **gcnv_backup_vault_list** - List all backup vaults in a project and location
   - Inputs: projectId, location, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_backup_vault_update** - Update a backup vault's properties
   - Inputs: projectId, location, backupVaultId, description (optional), labels (optional)

#### Backup Tools

1. **gcnv_backup_create** - Create a new backup of a volume
   - Inputs: projectId, location, backupVaultId, backupId, volumeName, description (optional), labels (optional)

2. **gcnv_backup_delete** - Delete an existing backup
   - Inputs: projectId, location, backupVaultId, backupId

3. **gcnv_backup_get** - Get details about a specific backup
   - Inputs: projectId, location, backupVaultId, backupId

4. **gcnv_backup_list** - List all backups in a backup vault
   - Inputs: projectId, location, backupVaultId, filter (optional), pageSize (optional), pageToken (optional)

5. **gcnv_backup_restore** - Restore a backup to a new or existing volume
   - Inputs: projectId, location, backupVaultId, backupId, targetStoragePoolId, targetVolumeId, restoreOption

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
   After building the project from source (or when relying on the published package via `npx @gcnv/gcnv-mcp-server@latest`), register the extension with the Gemini CLI. This enables Gemini to fork the stdio-based server on demand.

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
- `src/tools/handlers/storage-pool-handler.ts` - Storage pool tool implementation
- `src/tools/handlers/volume-handler.ts` - Volume tool implementation
- `src/tools/handlers/snapshot-handler.ts` - Snapshot tool implementation
- `src/tools/handlers/operation-handler.ts` - Operation tool implementation
- `src/tools/handlers/backup-vault-handler.ts` - Backup vault tool implementation
- `src/tools/handlers/backup-handler.ts` - Backup tool implementation
- `src/utils/netapp-client-factory.ts` - Factory for NetApp client creation

## Development

### Adding New Tools

1. Define the tool schema in a new or existing file in the `src/tools` directory
2. Implement the handler in the `src/tools/handlers` directory
3. Register the tool in `src/registry/register-tools.ts`

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

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
