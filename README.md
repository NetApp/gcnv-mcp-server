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

- **Long-running Operations Management**:
  - Get details of an operation by ID
  - Cancel in-progress operations
  - List operations with filtering and pagination

## Prerequisites

- Node.js 16 or higher
- Google Cloud project with NetApp Volumes API enabled
- Google Cloud authentication credentials

## Installation

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd GCNV-MCP-LOCAL
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Authenticate with Google Cloud:
   Ensure you have valid Google Cloud credentials set up. You can use one of the following methods:
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to a service account key file
   - Use Application Default Credentials (ADC) with `gcloud auth application-default login`

## Usage

### Starting the Server

Start the server with default configuration (port 3001):

```bash
npm start
```

Start with specific HTTP port:

```bash
npm run start:http:port
```

For development with auto-build:

```bash
npm run dev
```

The server will start on `http://localhost:3001/mcp` by default.

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

### Example Request (using cURL)

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invoke",
    "id": "12345",
    "name": "storage_pool_list",
    "parameters": {
      "projectId": "your-project-id",
      "location": "us-central1"
    }
  }'
```

## Architecture

The project follows a modular architecture:

- **Server**: Express.js based server with MCP integration
- **Tools**: Defined using Zod schemas for input validation
- **Handlers**: Implementation for each tool's functionality
- **Factory Pattern**: Uses a factory for managing NetApp client instances with caching

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
- `express` - Web server framework
- `zod` - Schema validation library

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

