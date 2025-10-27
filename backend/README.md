# Photo Archive Backend

Azure Functions backend for the Photo Archive application.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Azure Functions v4
- **Storage SDK**: @azure/storage-blob

## Project Structure

```
backend/
├── generate-sas-token/       # SAS token generation function
│   ├── index.ts              # Function implementation
│   ├── function.json         # Function configuration
│   └── README.md             # Function documentation
├── dist/                     # Compiled JavaScript (gitignored)
├── node_modules/             # Dependencies (gitignored)
├── host.json                 # Functions host configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies and scripts
└── local.settings.json       # Local configuration (gitignored)
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- Azure Functions Core Tools 4.x
- Azure Storage Account (deployed via infrastructure/)

### Installation

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Set up local configuration:
   ```bash
   cp local.settings.json.template local.settings.json
   ```

3. Get your storage connection string:
   ```bash
   # From the root of the project
   STORAGE_ACCOUNT=$(jq -r '.storageAccountName' .azure/dev-outputs.json)
   RESOURCE_GROUP=$(jq -r '.resourceGroup' .azure/dev-outputs.json)
   
   az storage account show-connection-string \
     --name $STORAGE_ACCOUNT \
     --resource-group $RESOURCE_GROUP \
     --output tsv
   ```

4. Update `local.settings.json` with the connection string:
   ```json
   {
     "Values": {
       "StorageConnectionString": "<paste-connection-string-here>"
     }
   }
   ```

### Running Locally

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the Functions runtime:
   ```bash
   npm start
   ```

3. The API will be available at:
   ```
   http://localhost:7071/api/generate-upload-token
   ```

### Development Workflow

Watch mode (auto-rebuild on file changes):
```bash
npm run watch
```

In another terminal:
```bash
npm start
```

## Available Functions

### 1. Generate Upload Token

**Endpoint:** `POST /api/generate-upload-token`

Generates a SAS token for direct upload to landing-zone.

See [generate-sas-token/README.md](./generate-sas-token/README.md) for details.

## Testing

### Manual Testing with curl

1. Generate a token:
   ```bash
   curl -X POST http://localhost:7071/api/generate-upload-token \
     -H "Content-Type: application/json" \
     -d '{"filename": "test.jpg"}'
   ```

2. Upload a file using the token:
   ```bash
   curl -X PUT "<uploadUrl-from-response>" \
     -H "x-ms-blob-type: BlockBlob" \
     -H "Content-Type: image/jpeg" \
     --data-binary @path/to/photo.jpg
   ```

3. Verify the upload in Azure Portal or with Azure CLI:
   ```bash
   az storage blob list \
     --container-name landing-zone \
     --account-name <storage-account> \
     --output table
   ```

### Testing with Postman

Import the collection from `docs/postman/` (TODO).

## Deployment

Deploy to Azure:

```bash
# From the backend directory
func azure functionapp publish <function-app-name>
```

Or use the infrastructure deployment scripts (TODO).

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `StorageConnectionString` | Azure Storage connection string | Required |
| `LANDING_ZONE_CONTAINER` | Landing zone container name | `landing-zone` |
| `PHOTOS_CONTAINER` | Photos container name | `photos` |
| `THUMBNAILS_CONTAINER` | Thumbnails container name | `thumbnails` |
| `SAS_TOKEN_EXPIRY_MINUTES` | SAS token expiration time | `5` |

## Troubleshooting

### "Cannot find module '@azure/functions'"

Run `npm install` to install dependencies.

### "StorageConnectionString not configured"

Make sure `local.settings.json` exists and contains your storage connection string.

### Function not responding

Check the terminal running `npm start` for errors. The function should show:
```
Functions:
  generate-upload-token: [POST] http://localhost:7071/api/generate-upload-token
```

### TypeScript errors

Run `npm run build` to see compilation errors. Fix them before running `npm start`.

## Next Steps

- [ ] Add image processing function (blob trigger)
- [ ] Add photo retrieval API
- [ ] Implement authentication
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Set up CI/CD pipeline

## Resources

- [Azure Functions TypeScript](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Azure Storage Blob SDK](https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob)
- [SAS Token Documentation](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
