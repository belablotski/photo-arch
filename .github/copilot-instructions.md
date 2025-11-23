# GitHub Copilot Instructions for Photo Archive Project

## Azure Functions Programming Model

**CRITICAL: This project uses Azure Functions v4 (pure v4 model)**

This project uses @azure/functions 4.5.0 with the **pure v4 programming model**:
- ✅ **Registration:** `app.http()` and `app.storageBlob()` in function files
- ✅ **Entry point:** All functions imported in `src/app.ts`
- ✅ **Request parsing:** `request.json()` works properly
- ✅ **Query params:** `request.query.get('paramName')`
- ✅ **Response format:** Return `HttpResponseInit` with `jsonBody`
- ✅ **No function.json:** Configuration in code only

### Function Registration

All functions are registered in their respective files and imported in `src/app.ts`.

**HTTP Triggers:**
```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

app.http('function-name', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'custom-route',  // Optional, defaults to function name
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log("Log message");
    
    // Parse body
    const body = await request.json();
    
    // Parse query parameters
    const param = request.query.get('paramName') || 'default';
    
    // Return response
    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      jsonBody: { data: "value" }
    };
  }
});
```

**Blob Triggers:**
```typescript
import { app, InvocationContext } from '@azure/functions';

app.storageBlob('function-name', {
  path: 'container-name/{name}',
  connection: 'StorageConnectionString',
  handler: async (blob: unknown, context: InvocationContext): Promise<void> => {
    const blobBuffer = blob as Buffer;
    const blobName = context.triggerMetadata?.name as string;
    
    context.log(`Processing: ${blobName}`);
    // Process blob
  }
});
```

### Main Entry Point

`src/app.ts` imports all functions:
```typescript
import { app } from '@azure/functions';

import './functions/generateUploadToken';
import './functions/processImage';
import './functions/getPhotos';
```

### Logging

Use `context.log()` for all logging:
```typescript
context.log('Information message');
context.log(`Processing: ${filename}`);
context.log('ERROR:', error);
```

### Response Format

HTTP functions return `HttpResponseInit`:
```typescript
return {
  status: 200,
  headers: { "Content-Type": "application/json" },
  jsonBody: { key: "value" }
};
```

### Query Parameters

Access query parameters using `.get()` method:
```typescript
const limit = parseInt(request.query.get('limit') || "20");
const filter = request.query.get('author') || undefined;
```

## TypeScript Configuration

- **Version:** 5.3.3
- **Target:** ES2022
- **Module:** CommonJS
- **Strict mode:** Enabled

## Project Structure

```
backend/
├── src/
│   ├── app.ts                       # Main entry point
│   └── functions/
│       ├── generateUploadToken.ts   # SAS token generation
│       ├── processImage.ts          # Image processing & deduplication
│       └── getPhotos.ts             # Photo retrieval API
├── host.json
├── package.json
├── tsconfig.json
└── local.settings.json   # Gitignored - secrets here
```

## Dependencies

- `@azure/functions`: ^4.5.0
- `@azure/storage-blob`: ^12.17.0  
- `sharp`: ^0.34.4 (image processing)
- `exifr`: ^7.1.3 (EXIF extraction from JPEG)
- `exiftool-vendored`: ^29.1.0 (RAW file support and EXIF extraction)

## Blob Tag Schema (10 tags max)

```typescript
await blobClient.setTags({
  "author": "john.doe",           // Photo owner/uploader
  "dateTaken": "2025-10-30",      // YYYY-MM-DD format
  "camera": "Canon-5D-Mark-IV",   // No spaces, use hyphens
  "lens": "50mm-f1.4",
  "location": "San-Francisco-CA",
  "rating": "0",                  // String "0"-"5"
  "customTag1": "vacation",
  "customTag2": "family",
  "customTag3": "beach",
  "favorite": "false"
});
```

**Blob path:** `photos/{uuid}.jpg` (flat structure, author in tags)

## Storage Containers

- `landing-zone` - Temporary upload storage (original filenames, cleaned after processing)
- `photos` - Permanent photo archive (content-hash names: `{name}_{hash8}.{ext}`)
- `thumbnails` - Generated thumbnails (300px width, matching hash-based names)
- `$web` - Static website hosting

## Naming Strategy

**Problem:** Camera filenames like `DSC_0001.jpg`, `IMG_0001.jpg` collide across shoots/users.

**Solution:** Content-hash postfix added server-side
- Upload: `DSC_0001.jpg` → landing-zone (original, simple)
- Process: Calculate SHA-256 hash → `d1cf8277...`
- Archive: `DSC_0001_d1cf8277.jpg` → photos (unique, collision-free)
- Metadata: `originalFilename: "DSC_0001.jpg"` preserved for display
- Deduplication: Same content = same hash = skip duplicate

## Common Patterns

### Generate SAS Token
```typescript
import { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';

const sasToken = generateBlobSASQueryParameters({
  containerName,
  blobName,
  permissions: BlobSASPermissions.parse("r"), // or "w" for write
  startsOn: new Date(),
  expiresOn: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
}, sharedKeyCredential).toString();
```

### Content-Hash Naming
```typescript
import { createHash } from 'crypto';

const fileHash = createHash('sha256').update(blobBuffer).digest('hex');
const hashPrefix = fileHash.substring(0, 8);
const permanentBlobName = `${nameWithoutExt}_${hashPrefix}${extension}`;
```

### Deduplication Check
```typescript
const photoBlobClient = containerClient.getBlockBlobClient(permanentBlobName);
const photoExists = await photoBlobClient.exists();
if (photoExists) {
  // Skip duplicate, delete from landing zone
  return;
}
```

### List Blobs with Pagination
```typescript
const iterator = containerClient.listBlobsFlat({
  prefix: `${author}/`,
  includeMetadata: true,
  includeTags: true
}).byPage({ maxPageSize: limit, continuationToken });

const page = (await iterator.next()).value;
```

### Image Processing with Sharp
```typescript
import sharp from 'sharp';

const thumbnail = await sharp(imageBuffer)
  .resize(300, null, { withoutEnlargement: true })
  .jpeg({ quality: 85, progressive: true })
  .toBuffer();
```

## Security

- ✅ All secrets in `local.settings.json` (gitignored)
- ✅ Connection strings use `StorageConnectionString` environment variable
- ✅ SAS tokens with minimal permissions and short expiration
- ⚠️ TODO: Add Azure AD authentication
- ⚠️ TODO: Add rate limiting

## Testing

- Build: `npm run build` (compiles TypeScript)
- Start: `func start` (runs Azure Functions locally)
- Test scripts in `backend/test-*.sh`

## Error Handling

Always catch errors and return proper HTTP responses:
```typescript
try {
  // Function logic
  return { status: 200, jsonBody: { success: true } };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  context.log(`Error: ${errorMessage}`);  // v3 style - context.log() only
  return {
    status: 500,
    headers: { "Content-Type": "application/json" },
    jsonBody: {
      error: "Descriptive error message",
      message: errorMessage
    }
  };
}
```

## Common Mistakes to Avoid

❌ Using `function.json` files (v3 style) - Use `app.http()` registration instead  
❌ Wrong parameter order (blob/request first) - In v4, request/blob comes first, context second  
❌ Using `context.info()`, `context.warn()`, `context.error()` - Use `context.log()` only  
❌ Using `body:` instead of `jsonBody:` in HTTP responses  
❌ Spaces in blob tag values (use hyphens: "Canon-5D-Mark-IV")  
❌ Numeric blob tag values (all values must be strings)  
❌ Forgetting to import functions in `src/app.ts`

## Best Practices

✅ Use TypeScript strict mode  
✅ Use `app.http()` and `app.storageBlob()` for function registration  
✅ Import all functions in `src/app.ts`  
✅ Add proper JSDoc comments to functions  
✅ Use descriptive variable names  
✅ Log important operations with context.log()  
✅ Return structured error responses  
✅ Include test scripts for manual testing  
✅ Store original filename in blob metadata  
✅ Generate content-hash names server-side for deduplication

## Metadata Architecture

- **Blob Index Tags** (10 max): Fast filtering, searchable
- **Blob Metadata** (8KB max): Basic file info, dimensions
- **Sidecar JSON** (future): Unlimited metadata storage

## Next Features to Implement

1. ✅ SAS Token Generation (Priority 1)
2. ✅ Image Processing (Priority 2)  
3. ✅ Photo Retrieval API (Priority 3)
4. ✅ Content-hash naming with deduplication (Priority 3.5)
5. ✅ EXIF extraction (Priority 3.8)
6. ✅ RAW file support with exiftool-vendored
7. ⬜ Sidecar JSON (Priority 3.9) - Optional for MVP
8. ⬜ Frontend Upload UI
9. ⬜ Frontend Gallery

---

**Last Updated:** November 23, 2025  
**Programming Model:** Azure Functions v4 (pure)  
**Package Version:** @azure/functions 4.5.0
**Node.js Version:** 18+  
**TypeScript Version:** 5.3.3
**RAW Support:** CR3, CR2, NEF, ARW, RAF, ORF, RW2, DNG, PEF via exiftool-vendored
