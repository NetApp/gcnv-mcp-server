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
- `src/tools/operation-tools.ts` - Operation tool definitions with schemas
- `src/tools/handlers/storage-pool-handler.ts` - Storage pool tool implementation
- `src/tools/handlers/volume-handler.ts` - Volume tool implementation
- `src/tools/handlers/operation-handler.ts` - Operation tool implementation
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
  │   ├── operation-tools.ts         # Operation tool definitions
  │   └── handlers/
  │       ├── storage-pool-handler.ts # Storage pool tool handlers
  │       ├── volume-handler.ts      # Volume tool handlers
  │       └── operation-handler.ts   # Operation tool handlers
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

