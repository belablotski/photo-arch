# Photo Archive Backend

Azure Functions backend for the Photo Archive application using **Azure Functions v4 Programming Model**.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Framework**: Azure Functions v4 (pure v4 model)
- **Storage SDK**: @azure/storage-blob 12.17
- **Image Processing**: sharp 0.34
- **EXIF Extraction**: exifr 7.1.3 (JPEG), exiftool-vendored 29.1.0 (RAW files)
- **RAW Support**: CR3, CR2, NEF, ARW, RAF, ORF, RW2, DNG, PEF

## Project Structure

```
backend/
├── src/
│   ├── app.ts                       # Main entry point (registers all functions)
│   └── functions/
│       ├── generateUploadToken.ts   # POST /api/generate-upload-token
│       ├── processImage.ts          # Blob trigger: landing-zone/{name}
│       └── getPhotos.ts             # GET /api/photos
├── dist/                            # Compiled JavaScript (gitignored)
├── test_photos/                     # Test images
├── test-upload-with-hash.sh         # End-to-end upload test
├── host.json                        # Functions host configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json                     # Dependencies and scripts
└── local.settings.json              # Local configuration (gitignored, secrets)
```

## Key Features

✅ **Content-Hash Based Naming** - Automatic deduplication via SHA-256 hash postfix  
✅ **Automatic Image Processing** - Thumbnail generation with sharp  
✅ **RAW File Support** - CR3, CR2, NEF, ARW, RAF, ORF, RW2, DNG, PEF via exiftool  
✅ **EXIF Extraction** - Full metadata from JPEG and RAW files  
✅ **SAS Token Security** - Time-limited upload tokens  
✅ **Blob Index Tags** - Fast filtering by author, date, camera, rating, lens  
✅ **Flat Storage Structure** - No directories, tags for organization  
✅ **Original Filename Preservation** - Stored in metadata for display

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

Generates a SAS token for direct upload to landing-zone container.

**Request:**
```json
{
  "filename": "DSC_0001.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "uploadUrl": "https://<account>.blob.core.windows.net/landing-zone/DSC_0001.jpg?<sas-token>",
  "blobName": "DSC_0001.jpg",
  "containerName": "landing-zone",
  "expiresAt": "2025-11-10T05:44:33.057Z"
}
```

**Features:**
- Original filename preserved in landing zone
- 5-minute expiration (configurable)
- Write-only permissions
- Filename sanitization (removes path separators)

### 2. Process Image (Blob Trigger)

**Trigger:** `landing-zone/{name}`

Automatically processes uploaded images:
1. Calculates SHA-256 hash of image content
2. Generates permanent name: `{originalName}_{hash8chars}.{ext}`
3. Checks for duplicates (same hash = same content)
4. If duplicate: deletes from landing zone, skips processing
5. If new: generates thumbnail, uploads to archive, deletes from landing zone

**Example:**
- Upload: `DSC_0001.jpg` → landing-zone
- Process: Hash = `d1cf8277...`
- Archive: `DSC_0001_d1cf8277.jpg` → photos & thumbnails
- Metadata: `originalFilename: "DSC_0001.jpg"`

### 3. Get Photos

**Endpoint:** `GET /api/photos`

Retrieves photos with filtering and pagination.

**Query Parameters:**
- `limit` - Results per page (default: 20)
- `continuationToken` - For pagination
- `author` - Filter by author tag
- `dateTaken` - Filter by date (supports `>=`, `<=`, `>`, `<`, `=`)
- `rating` - Filter by rating (supports operators)
- `camera`, `lens`, `location`, `customTag1-3`, `favorite` - Exact match filters

**Response:**
```json
{
  "photos": [
    {
      "id": "DSC_0001_d1cf8277.jpg",
      "originalFilename": "DSC_0001.jpg",
      "thumbnailUrl": "https://<sas-url>",
      "photoUrl": "https://<sas-url>",
      "uploadDate": "2025-11-10T05:39:45.000Z",
      "size": 2804736,
      "dimensions": { "width": 4032, "height": 3024 },
      "format": "jpeg",
      "tags": {
        "author": "default-user",
        "dateTaken": "2025-11-10",
        "rating": "0"
      }
    }
  ],
  "continuationToken": "...",
  "hasMore": true,
  "totalReturned": 20
}
```

## Testing

### Quick Test

Run the end-to-end test script:
```bash
cd backend
./test-upload-with-hash.sh
```

This will:
1. Request a SAS token
2. Upload a test photo to landing-zone
3. Trigger automatic processing
4. Show the expected behavior (hash-based naming, deduplication)

### Manual Testing with curl

1. Generate a token:
   ```bash
   curl -X POST http://localhost:7071/api/generate-upload-token \
     -H "Content-Type: application/json" \
     -d '{"filename": "test.jpg", "contentType": "image/jpeg"}'
   ```

2. Upload a file using the token:
   ```bash
   curl -X PUT "<uploadUrl-from-response>" \
     -H "x-ms-blob-type: BlockBlob" \
     -H "Content-Type: image/jpeg" \
     --data-binary @path/to/photo.jpg
   ```

3. List photos via API:
   ```bash
   curl http://localhost:7071/api/photos
   ```

4. Verify in Azure Storage:
   ```bash
   az storage blob list \
     --container-name photos \
     --account-name <storage-account> \
     --output table
   ```

### Test Deduplication

Upload the same file twice and check the server logs:
```bash
./test-upload-with-hash.sh  # First upload
./test-upload-with-hash.sh  # Second upload - should be detected as duplicate
```

Expected log message: `⚠️ Photo already exists: <filename>_<hash>.jpg - skipping upload (duplicate detected)`

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
| `PHOTOS_CONTAINER` | Photos archive container name | `photos` |
| `THUMBNAILS_CONTAINER` | Thumbnails container name | `thumbnails` |
| `SAS_TOKEN_EXPIRY_MINUTES` | SAS token expiration time (minutes) | `5` |
| `THUMBNAIL_WIDTH` | Thumbnail width in pixels (maintains aspect ratio) | `300` |

## Storage Architecture

### Container Structure

- **landing-zone** - Temporary upload storage (original filenames)
  - Files deleted after processing
  - Example: `DSC_0001.jpg`

- **photos** - Permanent archive with content-hash names
  - Flat structure (no directories)
  - Example: `DSC_0001_d1cf8277.jpg`
  - Metadata: originalFilename, uploadDate, dimensions, format
  - Tags: author, dateTaken, camera, lens, location, rating, etc.

- **thumbnails** - Generated thumbnails (300px width)
  - Same naming as photos: `DSC_0001_d1cf8277.jpg`
  - JPEG format, 85% quality, progressive

### Blob Naming Strategy

**Problem:** Camera-generated names like `DSC_0001.jpg`, `IMG_0001.jpg` collide across different shoots/users.

**Solution:** Content-hash postfix
- Upload: `DSC_0001.jpg` → landing-zone (simple, fast)
- Process: Calculate SHA-256 hash → `d1cf8277...`
- Archive: `DSC_0001_d1cf8277.jpg` → photos (unique, collision-free)
- Deduplication: Same content = same hash = detected duplicate

**Benefits:**
- ✅ No filename collisions
- ✅ Automatic deduplication
- ✅ Original filename preserved in metadata
- ✅ Simple upload (no client-side complexity)
- ✅ Server-side hash calculation (secure, consistent)

### Blob Tags (Max 10)

```typescript
{
  "author": "john.doe",           // Photo owner/uploader
  "dateTaken": "2025-11-10",      // YYYY-MM-DD format
  "camera": "Canon-5D-Mark-IV",   // No spaces, use hyphens
  "lens": "50mm-f1.4",
  "location": "San-Francisco-CA",
  "rating": "0",                  // String "0"-"5"
  "customTag1": "vacation",
  "customTag2": "family",
  "customTag3": "beach",
  "favorite": "false"             // String "true" or "false"
}
```

**Note:** All tag values must be strings (no numbers or booleans).

## Troubleshooting

### "Cannot find module '@azure/functions'"

Run `npm install` to install dependencies.

### "StorageConnectionString not configured"

Make sure `local.settings.json` exists and contains your storage connection string.

### Function not responding

Check the terminal running `npm start` for errors. The functions should show:
```
Functions:
  generate-sas-token: [POST] http://localhost:7071/api/generate-upload-token
  get-photos: [GET] http://localhost:7071/api/photos
  process-image: blobTrigger
```

### "Detected mixed function app" warning

You have both old v3/hybrid function folders and new v4 structure. Delete old folders:
```bash
rm -rf generate-sas-token process-image get-photos
```

### TypeScript errors

Run `npm run build` to see compilation errors. Fix them before running `npm start`.

### Blob trigger not firing

1. Check the server logs for "Processing image: <filename>"
2. Verify landing-zone container exists in Azure Storage
3. Check `local.settings.json` has correct `StorageConnectionString`
4. Try uploading via the test script: `./test-upload-with-hash.sh`

### Images not appearing in photos API

1. Check server logs for processing errors
2. Verify photos container exists
3. Use Azure Storage Explorer to check if blobs exist
4. Check blob tags are set correctly

## Architecture

### Upload Flow

```
1. Client → POST /api/generate-upload-token
   ↓
2. Server generates SAS token for landing-zone
   ↓
3. Client → PUT to Azure Storage (direct upload)
   ↓
4. Blob lands in landing-zone/DSC_0001.jpg
   ↓
5. Process-image function triggers automatically
   ↓
6. Calculate SHA-256 hash: d1cf8277...
   ↓
7. Check if photos/DSC_0001_d1cf8277.jpg exists
   ↓
8a. If exists → Delete from landing, skip (duplicate)
8b. If new → Generate thumbnail, upload both, delete from landing
```

### Deduplication Logic

```typescript
const fileHash = createHash('sha256').update(blob).digest('hex');
const hashPrefix = fileHash.substring(0, 8);
const permanentBlobName = `${originalName}_${hashPrefix}.${ext}`;

const photoExists = await photoBlobClient.exists();
if (photoExists) {
  // Skip duplicate, delete from landing zone
  return;
}
// Upload new photo
```

## Development

### Azure Functions v4 Model

This project uses the **pure v4 programming model**:

**HTTP Functions:**
```typescript
app.http('function-name', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'custom-route',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    const body = await request.json();
    return { status: 200, jsonBody: { data: "value" } };
  }
});
```

**Blob Triggers:**
```typescript
app.storageBlob('function-name', {
  path: 'container/{name}',
  connection: 'StorageConnectionString',
  handler: async (blob: unknown, context: InvocationContext) => {
    const blobBuffer = blob as Buffer;
    const blobName = context.triggerMetadata?.name as string;
    // Process blob
  }
});
```

**Key Differences from v3:**
- ✅ No `function.json` files needed
- ✅ All functions registered in `src/app.ts`
- ✅ Use `request.json()` for parsing body (works properly in v4)
- ✅ Use `request.query.get('param')` for query parameters
- ✅ Better TypeScript support
- ✅ Simpler deployment

See [V4_MIGRATION_COMPLETE.md](./V4_MIGRATION_COMPLETE.md) for migration details.

## Next Steps

- [x] SAS token generation (Priority 1)
- [x] Image processing with thumbnails (Priority 2)
- [x] Photo retrieval API with filtering (Priority 3)
- [x] Content-hash naming with deduplication (Priority 3.5)
- [x] EXIF data extraction from JPEG and RAW files (Priority 3.8)
- [x] RAW file support (CR3, CR2, NEF, ARW, RAF, ORF, RW2, DNG, PEF)
- [ ] Sidecar JSON for unlimited metadata (Priority 3.9) - Optional for MVP
- [ ] Frontend upload UI
- [ ] Frontend gallery with filtering
- [ ] Azure AD authentication
- [ ] Rate limiting
- [ ] Unit tests
- [ ] Integration tests
- [ ] CI/CD pipeline

## Resources

- [Azure Functions v4 TypeScript](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4)
- [Azure Storage Blob SDK](https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob)
- [SAS Token Documentation](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
- [Blob Index Tags](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-manage-find-blobs)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
