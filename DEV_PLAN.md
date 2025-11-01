# Development Plan: Photo Archive

This document outlines the development roadmap for the Photo Archive application, with focus on the critical path to MVP.

## Current Status

✅ **Phase 1: Foundation & Infrastructure** (COMPLETED)
- Azure Resource Group created
- Storage Account deployed with containers:
  - `landing-zone` - Temporary upload storage
  - `photos` - Permanent photo archive
  - `thumbnails` - Generated thumbnails
  - `$web` - Static website hosting
- Lifecycle policies configured (Hot → Cool → Archive)
- Blob versioning and soft delete enabled
- West US 2 region

✅ **Phase 2: Backend Core - Priority 1** (COMPLETED)
- Azure Functions project structure created
- TypeScript configuration
- Dependencies installed (@azure/functions, @azure/storage-blob, sharp)
- SAS Token Generation function implemented and tested locally
- Local development environment configured
- Security: connection strings properly gitignored

✅ **Phase 2: Backend Core - Priority 2** (COMPLETED)
- Image Processing function implemented and tested
- Blob trigger on landing-zone uploads
- Thumbnail generation with Sharp library
- Automatic cleanup and metadata storage
- Tested with multiple images successfully

**Deployment outputs:**
- Storage Account: `photoarchdev<unique-hash>st`
- Resource Group: `photo-archive-dev-rg`
- See `.azure/dev-outputs.json` for actual values (gitignored)

---

## Next Steps: Critical Path to MVP

### 🔥 **PRIORITY 1: SAS Token Generation Function** ✅ COMPLETED

**Status:** ✅ Implemented and tested locally

**Implementation:**
```
backend/
├── generate-sas-token/
│   ├── index.ts          # HTTP trigger handler ✅
│   ├── function.json     # Function configuration ✅
│   └── README.md         # Function documentation ✅
├── host.json             # Functions host config ✅
├── tsconfig.json         # TypeScript config ✅
├── package.json          # Dependencies ✅
├── local.settings.json   # Local config (gitignored) ✅
└── TESTING.md            # Testing guide ✅
```

**Completed:**
- ✅ HTTP-triggered function at `POST /api/generate-upload-token`
- ✅ Accepts filename and optional content type
- ✅ Generates write-only SAS token (5 min expiration)
- ✅ Filename sanitization (prevents directory traversal)
- ✅ Input validation and error handling
- ✅ Returns uploadUrl, blobName, containerName, expiresAt
- ✅ Local testing with curl
- ✅ Documentation and test scripts
- ✅ Code committed and pushed to GitHub

**Technical Implementation Details:**
- **Programming Model:** Azure Functions v3 (function.json approach)
  - Parameter order: `context, request` (not `request, context`)
  - Logging: Only `context.log()` available (no `context.error()` in v3)
- **Dependencies:** @azure/functions 4.5.0, @azure/storage-blob 12.17.0
- **Security:** Connection strings in `local.settings.json` (gitignored)

**Next:** Deploy to Azure (optional, can do after Priority 2)

---

### 🔥 **PRIORITY 2: Image Processing Function** ✅ COMPLETED

**Status:** ✅ Implemented and tested successfully

**Implementation:**
```
backend/process-image/
├── index.ts          # Blob trigger handler ✅
├── function.json     # Blob trigger configuration ✅
└── README.md         # Function documentation ✅
backend/TESTING_PROCESS_IMAGE.md  # Testing guide ✅
backend/test-process-image.sh     # Test upload script ✅
```

**Completed:**
- ✅ Blob-triggered on landing-zone uploads
- ✅ Generate thumbnail (300px width, maintain aspect ratio)
- ✅ Copy original to `photos/` container with metadata
- ✅ Copy thumbnail to `thumbnails/` container
- ✅ Add metadata (size, dimensions, upload date, format)
- ✅ Delete from landing-zone ONLY after success
- ✅ Error handling: leaves in landing-zone for retry
- ✅ Uses Sharp library for fast image processing
- ✅ **Tested locally with multiple images**
- ✅ **Verified container cleanup and thumbnail generation**

**Dependencies:**
- `@azure/storage-blob` SDK ✅
- `sharp` ^0.33.5 (image processing library) ✅

**Technical Implementation Details:**
- **Trigger Type:** Blob trigger on `landing-zone/{name}`
- **Image Processing:** Sharp library (native C++, fast)
- **Thumbnail:** 300px width (configurable), maintains aspect ratio
- **Output:** Optimized JPEG, 85% quality, progressive
- **Metadata:** Width, height, format, size, upload date
- **Error Strategy:** Leave blob in landing-zone for automatic retry
- **v3 Model Note:** Uses `bindingData.blobTrigger` to get blob path
- **Compression:** Achieves ~99.5% size reduction (2.8MB → 13KB thumbnails)

**Test Results:**
```
Landing Zone: ✅ Empty (properly cleaned up)
Photos:       ✅ 3 images at full size (1.7-2.8MB each)
Thumbnails:   ✅ 3 thumbnails at ~13KB each
Processing:   ✅ Automatic trigger, metadata preserved
```

**Known Issues / Future Enhancements:**
- ⚠️ **Filename Collision Handling:** Currently preserves original filenames, which can cause overwrites
  - See Priority 3.5 below for collision prevention strategy

**Next:** Commit changes, then implement Priority 3 (Photo Retrieval API)

---

### 🔥 **PRIORITY 3: Photo Retrieval API**

**Why Critical:**
- Enables photo gallery display
- Required for frontend browsing
- Completes read workflow

**Implementation:**
```
backend/get-photos/
├── index.ts          # HTTP trigger handler
├── function.json     # Function configuration
└── README.md         # Function documentation
```


### 🔥 **PRIORITY 3: Photo Retrieval API**

**Why Critical:**
- Enables photo gallery display
- Required for frontend browsing
- Completes read workflow

**Implementation:**
```
backend/functions/get-photos/
├── index.ts          # HTTP trigger handler
├── function.json     # Function configuration
└── README.md         # Function documentation
```

**Functionality:**
1. HTTP-triggered (GET `/api/photos`)
2. Query parameters: `?limit=20&continuationToken=xxx`
3. Lists photos from `photos/` container
4. Returns metadata and thumbnail URLs
5. Supports pagination

**Response Format:**
```json
{
  "photos": [
    {
      "id": "photo-123.jpg",
      "thumbnailUrl": "https://...",
      "uploadDate": "2025-10-26T...",
      "size": 2048576,
      "dimensions": { "width": 4032, "height": 3024 }
    }
  ],
  "continuationToken": "xxx",
  "hasMore": true
}
```

**Acceptance Criteria:**
- ✅ Returns list of photos with metadata
- ✅ Pagination works correctly
- ✅ Thumbnail URLs are accessible
- ✅ Can test with browser

**Estimated Time:** 3-4 hours

---

## Phase 2: Frontend Development (After Backend Core)

### Step 4: React SPA Setup
- Initialize React project
- Set up routing
- Configure Azure AD authentication (placeholder for now)

### Step 5: Upload Interface
- File upload component with drag-and-drop
- Request SAS token from backend
- Direct-to-blob upload with progress tracking
- Success/error feedback

### Step 6: Photo Gallery
- Responsive grid layout
- Infinite scroll or pagination
- Photo lightbox view
- Display metadata

**Estimated Time:** 1-2 weeks

---

## Phase 3: Enhanced Features (Post-MVP)

### Filename Collision Prevention (Priority 3.5)
**Why Important:**
- Current implementation preserves original filenames
- Multiple photos with same name will overwrite each other
- Need unique identifiers while preserving original name for display

**Proposed Solutions:**

**Option 1: UUID-based naming (Simplest for MVP)**
```typescript
// Generate unique name, store original in metadata
const uniqueId = crypto.randomUUID();
const extension = path.extname(originalName);
const storedName = `${uniqueId}${extension}`;
// Store originalName in blob metadata
```
- ✅ Simple, guaranteed unique
- ✅ Fast lookups by ID
- ❌ Loses human-readable names in storage

**Option 2: Content-based hashing (Best for deduplication)**
```typescript
// Hash file content + store original name
const hash = crypto.createHash('sha256').update(buffer).digest('hex');
const storedName = `${hash}_${originalName}`;
```
- ✅ Automatic deduplication of identical photos
- ✅ Preserves some context in filename
- ❌ Slightly slower (need to hash full content)

**Option 3: Date-based folders + UUID**
```typescript
// Organize by upload date
const date = new Date().toISOString().split('T')[0]; // "2025-10-31"
const storedPath = `${date}/${crypto.randomUUID()}${extension}`;
```
- ✅ Natural organization by date
- ✅ Easy to browse by time period
- ❌ More complex path structure

**Recommendation for MVP:** Option 1 (UUID)
- Implement in `generate-sas-token` or `process-image` function
- Store `originalFilename` in blob metadata
- Use UUID for storage, display original name in UI

**Implementation Location:**
- Frontend generates UUID before upload, OR
- `generate-sas-token` generates UUID for SAS URL, OR  
- `process-image` renames during processing (current approach)

**Estimated Time:** 1-2 hours

---

### Upload Status Tracking (Priority 3.6)
**Why Important:**
- Users need confirmation that uploads completed successfully
- Show processing status: pending → processing → complete → failed
- Enable "Your Recent Uploads" view in UI
- Track failed uploads for retry

**Current State:**
- ✅ Application Insights logs all function executions (free tier)
- ✅ Blob metadata stores upload date and metadata
- ❌ No real-time status tracking for users
- ❌ No dedicated upload history view

**Proposed Solutions:**

**Option 1: Application Insights Queries (Simplest)**
- Query App Insights for successful process-image executions
- Show recent uploads in UI by querying logs
- ✅ Already available, no new resources
- ❌ Slight delay (1-2 min), not real-time
- ❌ More complex queries

**Option 2: Azure Table Storage (Recommended)**
```typescript
// Add output binding to process-image function
{
  partitionKey: userId,      // Group by user
  rowKey: blobName,          // Unique photo ID
  status: 'complete',        // pending/processing/complete/failed
  uploadDate: timestamp,
  originalName: filename,
  thumbnailUrl: url,
  error: errorMessage        // If failed
}
```
- ✅ Fast queries by user
- ✅ Real-time status updates
- ✅ Easy to build "Recent Uploads" UI
- ✅ Very cheap (pennies per month)
- ❌ Requires new resource + code changes

**Option 3: Cosmos DB (Overkill for MVP)**
- Full NoSQL database with rich querying
- ❌ More expensive, unnecessary for MVP

**Recommendation for MVP:** 
- Start with **blob metadata** (already implemented)
- Photo Retrieval API (Priority 3) reads metadata to show uploads
- Add **Table Storage tracking** in Priority 4-5 for status tracking

**Implementation Tasks:**
1. Create Azure Table Storage table (or reuse storage account)
2. Add output binding to `process-image` function
3. Write status record on success/failure
4. Add API endpoint to query user's upload status
5. Frontend polls or uses SignalR for updates

**Estimated Time:** 2-3 hours

---

### EXIF Metadata Extraction (Priority 3.7)
**Why Important:**
- Sort photos by actual date taken (not upload date)
- Enable map view with GPS coordinates
- Rich search/filter by camera, location, date
- Preserve photographer's original metadata

**Implementation:**
- Add `exifr` library to extract EXIF data
- Extract key fields: DateTimeOriginal, Make, Model, GPS, Orientation
- Store in blob metadata for fast queries
- Handle missing EXIF gracefully (screenshots, web images)

**Key EXIF Fields:**
```typescript
{
  dateTaken: string;        // EXIF DateTimeOriginal
  camera: string;           // EXIF Make + Model  
  gpsLatitude: string;      // EXIF GPS
  gpsLongitude: string;     // EXIF GPS
  orientation: string;      // EXIF Orientation
  focalLength: string;      // Optional: lens info
  aperture: string;         // Optional: f-stop
  iso: string;              // Optional: ISO value
}
```

**Limitations:**
- Azure Blob metadata: 8KB max, ASCII only
- Need to be selective about fields
- Some images won't have EXIF

**Estimated Time:** 2-3 hours

---

### AI Tagging Integration
- Azure Cognitive Services Computer Vision API
- Add tags during image processing
- Search by tags

### Advanced Search & Filtering
- Filter by date range
- Filter by tags
- Full-text search

### Lifecycle Management Monitoring
- Dashboard for storage costs
- Alerts for stuck uploads
- Rehydration UI for archived photos

**Estimated Time:** 2-3 weeks

---

## Technology Stack Decisions

### Backend: Node.js + TypeScript ✅
**Rationale:**
- Modern, type-safe development
- Excellent Azure SDK support
- Strong ecosystem for image processing
- Easy debugging and testing

**Implementation Choice:**
- Using Azure Functions v3 programming model (function.json)
- @azure/functions v4.5.0 package (supports both v3 and v4 models)
- Context-first parameter order: `(context, request)`

**Alternatives Considered:**
- JavaScript (simpler but less type-safe)
- Python (good but Node.js has better Azure Functions tooling)
- Azure Functions v4 programming model (decided to use v3 for simplicity)

### Frontend: React ⚡
**Rationale:**
- Large ecosystem
- Good Azure integration
- Static site hosting compatible

### Image Processing: Sharp 🖼️
**Rationale:**
- Fast (native C++ bindings)
- Supports all common formats
- Good memory management
- Works well in serverless

---

## Development Workflow

### Local Development
1. Start Azure Functions: `cd backend && func start`
2. Test with curl or test scripts: `./test-function.sh`
3. Check function logs in terminal
4. Build TypeScript: `npm run build` (auto-runs before start)

**Local Environment Setup:**
- Copy `local.settings.json.template` → `local.settings.json`
- Fill in your Azure Storage connection string
- File is gitignored for security

### Testing Strategy
1. **Unit Tests**: Each function in isolation (TODO)
2. **Integration Tests**: End-to-end upload workflow (TODO)
3. **Manual Testing**: Curl commands and test scripts ✅

### Deployment
1. **Dev**: Auto-deploy on push to `main` (CI/CD setup later)
2. **Staging**: Manual promotion from dev
3. **Production**: Tagged releases only

---

## Critical Path Summary

```
[DONE] Storage Infrastructure ✅
   ↓
[DONE] SAS Token Generation ✅
   ↓
[NEXT] Image Processing Function ← YOU ARE HERE
   ↓
Photo Retrieval API
   ↓
Frontend Upload UI
   ↓
Frontend Gallery
   ↓
MVP COMPLETE ✨
```

---

## Risk Mitigation

### Data Loss Prevention
- ✅ Soft delete enabled (7 days)
- ✅ Blob versioning enabled
- ✅ No automatic landing-zone deletion (function handles cleanup)
- ⚠️ TODO: Add monitoring for stuck files

### Cost Management
- ✅ Lifecycle policies configured
- ✅ LRS for dev (cheap)
- ⚠️ TODO: Add cost monitoring dashboard
- ⚠️ TODO: Set up budget alerts

### Security
- ✅ HTTPS-only enabled
- ✅ Public access disabled
- ⚠️ TODO: Add Azure AD authentication
- ⚠️ TODO: Add rate limiting
- ⚠️ TODO: Add input validation

---

## Next Action Items

**Immediate (This Week):**
1. ✅ Create Azure Functions project structure
2. ✅ Implement SAS Token Generation function
3. ✅ Test locally with curl
4. ✅ Implement Image Processing function
5. ✅ Test end-to-end upload workflow

**Short Term (Next Week):**
1. Implement Photo Retrieval API ← **YOU ARE HERE**
2. Test gallery listing functionality
3. Basic frontend upload UI
4. Deploy backend to Azure (optional)

**Medium Term (Next 2-3 Weeks):**
1. Complete photo gallery UI
2. Add authentication
3. Deploy frontend to $web container
4. End-to-end testing

---

## Questions to Resolve

1. **Authentication**: Azure AD, custom auth, or start with API keys?
   - *Recommendation*: Start with simple bearer tokens, migrate to Azure AD later

2. **Image formats**: Support RAW photos (CR2, NEF, etc.)?
   - *Recommendation*: Start with JPEG/PNG, add RAW support later

3. **Max upload size**: 50MB limit enough?
   - *Recommendation*: 50MB good for JPEG, increase for RAW

4. **Thumbnail size**: 300px width sufficient?
   - *Recommendation*: Generate multiple sizes (150px, 300px, 600px)

---

**Last Updated:** November 1, 2025  
**Status:** Phase 2 (Priority 1 & 2) Complete ✅  
**Next Milestone:** Photo Retrieval API (Priority 3)  
**Git Status:** Ready to commit Priority 2 changes
