# GitHub Copilot Instructions for Photo Archive Project

## Azure Functions Programming Model

**CRITICAL: This project uses a HYBRID model with @azure/functions 4.5.0**

This project uses @azure/functions 4.5.0 package but with a **hybrid v3/v4 programming model**:
- ✅ **Parameter order:** v3 style - `context` FIRST, then request/blob
- ✅ **Logging:** v3 style - `context.log()` only
- ✅ **Query params:** v3 style - `req.query.paramName` (plain object, not URLSearchParams)
- ✅ **Response format:** v4 style - `jsonBody` instead of `body`
- ✅ **Return type:** v4 style - Return `HttpResponseInit` directly

### Function Signatures

**HTTP Triggers:**
```typescript
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function functionName(
  context: InvocationContext,
  request: HttpRequest
): Promise<HttpResponseInit> {
  // Parameter order: context FIRST, request SECOND (v3 style)
  context.log("Log message");  // Use context.log() for all logging (v3 style)
  
  // Parse query parameters (v3 style - plain object)
  const query = request.query as any;
  const param = query.paramName || 'default';
  
  // Parse body
  const body = await request.json();
  
  // Return response (v4 style - jsonBody)
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    jsonBody: { data: "value" }
  };
}
```

**Blob Triggers:**
```typescript
import { InvocationContext } from '@azure/functions';

export async function functionName(
  context: InvocationContext,
  blob: Buffer
): Promise<void> {
  // Parameter order: context FIRST, blob SECOND (v3 style)
  context.log("Processing blob");
  
  // Get blob name from binding data (v3 style)
  const bindingData = (context as any).bindingData;
  const blobName = bindingData?.name as string;
  const blobPath = bindingData?.blobTrigger as string;
}
```

### function.json Configuration

All functions MUST include:
```json
{
  "bindings": [...],
  "scriptFile": "../dist/function-folder/index.js",
  "entryPoint": "functionName"
}
```

### Logging

- ✅ `context.log()` - All logging (information, warnings, errors)
- ❌ `context.info()`, `context.warn()`, `context.error()` - NOT available in @azure/functions 4.5.0

### Response Format

HTTP functions return `HttpResponseInit`:
```typescript
return {
  status: 200,
  headers: { "Content-Type": "application/json" },
  jsonBody: { key: "value" }  // v4 style - use jsonBody, not body
};
```

### Query Parameters

Access query parameters as plain object properties (v3 runtime behavior):
```typescript
const query = request.query as any;
const param = query.paramName || 'defaultValue';
```

**Note:** Despite TypeScript types showing `URLSearchParams`, at runtime `request.query` is a plain object.

## TypeScript Configuration

- **Version:** 5.3.3
- **Target:** ES2022
- **Module:** CommonJS
- **Strict mode:** Enabled

## Project Structure

```
backend/
├── function-name/
│   ├── index.ts          # Function implementation
│   ├── function.json     # Binding configuration (must include scriptFile + entryPoint)
│   └── README.md         # Documentation
├── host.json
├── package.json
├── tsconfig.json
└── local.settings.json   # Gitignored - secrets here
```

## Dependencies

- `@azure/functions`: ^4.5.0
- `@azure/storage-blob`: ^12.17.0  
- `sharp`: ^0.34.4 (image processing)

## Blob Tag Schema (10 tags max)

```typescript
await blobClient.setTags({
  "dateTaken": "2025-10-30",      // YYYY-MM-DD format
  "camera": "Canon-5D-Mark-IV",   // No spaces, use hyphens
  "lens": "50mm-f1.4",
  "location": "San-Francisco-CA",
  "hasGPS": "true",               // String "true" or "false"
  "rating": "0",                  // String "0"-"5"
  "customTag1": "vacation",
  "customTag2": "family",
  "customTag3": "beach",
  "favorite": "false"
});
```

**Author stored in blob path:** `photos/{author}/{uuid}.jpg`

## Storage Containers

- `landing-zone` - Temporary upload storage (cleaned after processing)
- `photos` - Permanent photo archive  
- `thumbnails` - Generated thumbnails (300px width)
- `$web` - Static website hosting

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

❌ Wrong parameter order (request/blob first) - Context must be FIRST
❌ Using `context.info()`, `context.warn()`, `context.error()` (not available)
❌ Using `request.query.get('param')` - Use `request.query.param` instead (plain object at runtime)
❌ Using `body:` instead of `jsonBody:` in HTTP responses  
❌ Forgetting `scriptFile` and `entryPoint` in function.json  
❌ Spaces in blob tag values (use hyphens: "Canon-5D-Mark-IV")  
❌ Numeric blob tag values (all values must be strings)

## Best Practices

✅ Use TypeScript strict mode  
✅ Context parameter FIRST in all functions
✅ Cast `request.query` to `any` to access properties
✅ Add proper JSDoc comments to functions  
✅ Include README.md for each function  
✅ Use descriptive variable names  
✅ Log important operations with context.log()  
✅ Return structured error responses  
✅ Include test scripts for manual testing  
✅ Store original filename in blob metadata  
✅ Generate unique blob names (UUIDs) to prevent collisions

## Metadata Architecture

- **Blob Index Tags** (10 max): Fast filtering, searchable
- **Blob Metadata** (8KB max): Basic file info, dimensions
- **Sidecar JSON** (future): Unlimited metadata storage

## Next Features to Implement

1. ✅ SAS Token Generation (Priority 1)
2. ✅ Image Processing (Priority 2)  
3. 🔄 Photo Retrieval API (Priority 3) - IN PROGRESS
4. Frontend Upload UI
5. Frontend Gallery
6. UUID-based naming (Priority 3.5)
7. EXIF extraction (Priority 3.8)
8. Sidecar JSON (Priority 3.9)

---

**Last Updated:** November 2, 2025  
**Programming Model:** Hybrid v3/v4 (v3 parameter order & logging, v4 response format)  
**Package Version:** @azure/functions 4.5.0
**Node.js Version:** 18+  
**TypeScript Version:** 5.3.3
