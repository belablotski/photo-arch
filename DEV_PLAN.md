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

✅ **Phase 2: Backend Core - Priority 3** (COMPLETED)
- Photo Retrieval API implemented and tested
- Filtering by blob index tags (author, date, camera, rating, etc.)
- Pagination with continuation tokens
- SAS URL generation for secure photo access

✅ **Phase 2: Backend Core - Priority 3.5** (COMPLETED)
- Content-hash based naming with deduplication
- SHA-256 hash postfix prevents filename collisions
- Server-side hash calculation (no client complexity)
- Automatic duplicate detection and skipping
- Original filename preserved in metadata

✅ **Azure Functions v4 Migration** (COMPLETED - Nov 10, 2025)
- Migrated from hybrid v3/v4 to pure v4 programming model
- All functions use `app.http()` and `app.storageBlob()` registration
- Entry point: `src/app.ts` imports all functions
- No more `function.json` files
- Better TypeScript support and cleaner code
- See `backend/V4_MIGRATION_COMPLETE.md` for details

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
- **Programming Model:** Azure Functions v4 (pure v4 model) ✅ **MIGRATED**
  - Uses `app.http()` registration in function files
  - Entry point: `src/app.ts` imports all functions
  - Request parsing: `request.json()` works properly
  - Query params: `request.query.get('paramName')`
  - No `function.json` files needed
  - See `backend/V4_MIGRATION_COMPLETE.md` and `.github/copilot-instructions.md` for details
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
- **Metadata:** Width, height, format, size, upload date, originalFilename
- **Error Strategy:** Leave blob in landing-zone for automatic retry
- **v4 Model:** Uses `app.storageBlob()` registration
- **Naming Strategy:** Content-hash postfix (`{name}_{hash8}.{ext}`) ✅ **IMPLEMENTED**
- **Deduplication:** Checks if hash-based filename exists, skips if duplicate ✅ **IMPLEMENTED**
- **Compression:** Achieves ~99.5% size reduction (2.8MB → 13KB thumbnails)

**Test Results:**
```
Landing Zone: ✅ Empty (properly cleaned up)
Photos:       ✅ 3 images at full size (1.7-2.8MB each)
Thumbnails:   ✅ 3 thumbnails at ~13KB each
Processing:   ✅ Automatic trigger, metadata preserved
```

**Known Issues / Future Enhancements:**
- ✅ **Filename Collision Handling:** RESOLVED via Priority 3.5 (content-hash naming)

**Next:** Priority 3 (Photo Retrieval API) ✅ COMPLETED

---

### 🔥 **PRIORITY 3: Photo Retrieval API** ✅ COMPLETED

**Status:** ✅ Implemented and tested successfully (Nov 10, 2025)

**Implementation:**
```
backend/src/functions/getPhotos.ts  ✅ Implemented
backend/test-get-photos.sh          ✅ Test script
```

**Completed:**
- ✅ HTTP-triggered (GET `/api/photos`)
- ✅ Query parameters: `limit`, `continuationToken`, tag filters
- ✅ Lists photos from `photos/` container with metadata
- ✅ Returns SAS URLs for thumbnails and full photos (1 hour expiration)
- ✅ Supports pagination via continuation tokens
- ✅ Filtering by blob index tags (author, dateTaken, camera, rating, etc.)
- ✅ Comparison operators for date and rating (>=, <=, >, <, =)
- ✅ Tested locally with multiple photos

**Response Format:**
```json
{
  "photos": [
    {
      "id": "DSC_0001_d1cf8277.jpg",
      "originalFilename": "DSC_0001.jpg",
      "thumbnailUrl": "https://...<sas-token>",
      "photoUrl": "https://...<sas-token>",
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

**Acceptance Criteria:**
- ✅ Returns list of photos with metadata
- ✅ Pagination works correctly
- ✅ Thumbnail and photo URLs are accessible
- ✅ Filtering by tags works (author, date, rating, etc.)
- ✅ Can test with curl and browser

**Test Results:**
```bash
# List all photos
curl http://localhost:7071/api/photos

# Filter by date (>=)
curl "http://localhost:7071/api/photos?dateTaken>=2025-11-01"

# Pagination
curl "http://localhost:7071/api/photos?limit=10"
```

**Next:** Priority 3.5 (Filename Collision Prevention) ✅ COMPLETED

---

### 🔥 **PRIORITY 3.5: Filename Collision Prevention** ✅ COMPLETED

**Status:** ✅ Implemented and tested successfully (Nov 10, 2025)

---

### 🔥 **PRIORITY 3.5: Filename Collision Prevention** ✅ COMPLETED

**Status:** ✅ Implemented and tested successfully (Nov 10, 2025)

**Why Important:**
- Camera-generated filenames (DSC_0001.jpg, IMG_0001.jpg) collide across different shoots/users
- Need unique identifiers while preserving original name for display
- Enable automatic deduplication of identical photos

**Implemented Solution: Content-based hashing**
```typescript
// Hash file content + generate unique name
const fileHash = createHash('sha256').update(blobBuffer).digest('hex');
const hashPrefix = fileHash.substring(0, 8);
const permanentBlobName = `${nameWithoutExt}_${hashPrefix}${extension}`;
// Example: DSC_0001.jpg → DSC_0001_d1cf8277.jpg
```

**Benefits:**
- ✅ Automatic deduplication of identical photos (same content = same hash)
- ✅ Preserves context in filename (human-readable prefix)
- ✅ No client-side complexity (hash calculated server-side)
- ✅ Original filename preserved in blob metadata for UI display
- ✅ Fast duplicate detection via blob.exists() check

**Implementation:**
```
backend/src/functions/processImage.ts  ✅ Content-hash naming
backend/src/functions/generateUploadToken.ts  ✅ Simple filename sanitization
backend/test-upload-with-hash.sh  ✅ End-to-end test with deduplication
```

**Workflow:**
1. Client uploads `DSC_0001.jpg` to landing-zone (original name)
2. Process-image triggers automatically
3. Calculate SHA-256 hash: `d1cf8277...`
4. Generate permanent name: `DSC_0001_d1cf8277.jpg`
5. Check if already exists (deduplication)
6. If duplicate: delete from landing, skip processing
7. If new: generate thumbnail, upload both, delete from landing

**Test Results:**
```bash
# First upload
./test-upload-with-hash.sh
# Result: DSC_0001_d1cf8277.jpg created

# Second upload (same file)
./test-upload-with-hash.sh
# Server log: "⚠️ Photo already exists: DSC_0001_d1cf8277.jpg - skipping upload (duplicate detected)"
# Result: Duplicate detected and skipped ✅
```

**Acceptance Criteria:**
- ✅ No filename collisions (different photos get different hashes)
- ✅ Duplicate detection works (same photo uploaded twice is skipped)
- ✅ Original filename preserved in metadata
- ✅ Simple upload experience (no client-side hashing required)
- ✅ Hash-based naming in archive storage
- ✅ Tested end-to-end

**Next:** Priority 3.8 (EXIF Extraction) - Future enhancement

---

## Phase 2: Frontend Development (After Backend Core)

This section was previously "Filename Collision Prevention (Priority 3.5)" and has been moved up as completed.

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

### RAW+JPEG Pair Association (Priority 3.6)
**Why Important:**
- Professional photographers shoot RAW+JPEG simultaneously
- Need to keep pairs associated as one logical photo
- Display JPEG thumbnail, preserve RAW for editing
- Common pairs: `.CR3`+`.JPG` (Canon), `.NEF`+`.JPG` (Nikon), `.ARW`+`.JPG` (Sony)

**Problem:**
- `_MG_1234.CR3` and `_MG_1234.JPG` are the same photo
- Need to link them together in metadata
- Display as one photo in gallery (not two)
- Allow downloading either version

**Proposed Solution:**

**1. Detection Strategy:**
```typescript
// Extract base filename without extension
const getBaseName = (filename: string) => {
  const lastDot = filename.lastIndexOf('.');
  return filename.substring(0, lastDot);
};

// Example: "_MG_1234.CR3" → "_MG_1234"
//          "_MG_1234.JPG" → "_MG_1234"
```

**2. Sidecar JSON Structure:**
```typescript
{
  "id": "uuid-12345",
  "originalFilename": "_MG_1234",  // Base name without extension
  "uploadDate": "2025-11-01T05:00:00Z",
  
  // Multiple file variants
  "files": {
    "jpeg": {
      "filename": "_MG_1234.JPG",
      "blobPath": "photos/uuid-12345.jpg",
      "size": 2808136,
      "format": "jpeg"
    },
    "raw": {
      "filename": "_MG_1234.CR3",
      "blobPath": "photos/uuid-12345.cr3",
      "size": 28081360,
      "format": "cr3"
    }
  },
  
  // Use JPEG for display, preserve RAW
  "primary": "jpeg",  // Which version to display
  "hasRaw": true,     // Quick flag for filtering
  
  "exif": { /* extracted from RAW or JPEG */ },
  // ... rest of metadata
}
```

**3. Blob Tag for Filtering:**
```typescript
await blobClient.setTags({
  "author": "john.doe",
  "yearMonth": "2025-10",
  "hasRaw": "true",    // ← New tag for RAW pairs
  "camera": "Canon-5D",
  // ... other tags
});
```

**4. Implementation Approach:**

**Option A: Link during upload (Recommended)**
- User uploads both files together
- Process-image function detects matching base names
- Creates single JSON metadata with both file references
- Gallery shows one photo with "RAW available" badge

**Option B: Link after upload**
- User uploads files separately
- System detects matching base names in metadata
- Merges metadata entries when second file arrives
- More complex but handles async uploads

**5. Gallery Display:**
```typescript
// Frontend shows one photo card:
{
  thumbnail: "thumbnails/uuid-12345.jpg",  // From JPEG
  badge: "RAW+JPEG",                       // Indicator
  downloadOptions: [
    { label: "Download JPEG", url: "photos/uuid-12345.jpg" },
    { label: "Download RAW", url: "photos/uuid-12345.cr3" }
  ]
}
```

**Benefits:**
- ✅ Professional photographer workflow support
- ✅ No duplicate entries in gallery
- ✅ Preserve RAW for future editing
- ✅ Use optimized JPEG for thumbnails/display
- ✅ Clear indication of RAW availability
- ✅ User can download either format

**Implementation Tasks:**
1. Detect file pairs by base filename
2. Update JSON schema to support multiple file variants
3. Store both files with linked metadata
4. Add `hasRaw` blob tag for filtering
5. Update gallery API to return pair information
6. Frontend shows "RAW available" indicator
7. Download menu offers both formats

**Edge Cases to Handle:**
- Upload JPEG first, RAW later (or vice versa)
- Same base name, different cameras (rare but possible)
- Orphaned files (RAW without JPEG or vice versa)

**Estimated Time:** 4-5 hours

---

### Upload Status Tracking (Priority 3.7)
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

### EXIF Metadata Extraction (Priority 3.8) ✅ COMPLETED

**Status:** ✅ Implemented and tested successfully (Nov 23, 2025)

**Why Important:**
- Sort photos by actual date taken (not upload date)
- Enable map view with GPS coordinates
- Rich search/filter by camera, location, date
- Preserve photographer's original metadata

**Implementation:**
- ✅ Added `exifr` library for JPEG EXIF extraction
- ✅ Added `exiftool-vendored` library for RAW file support (CR3, CR2, NEF, ARW, RAF, ORF, RW2, DNG, PEF)
- ✅ Extract key fields: DateTimeOriginal, Make, Model, LensModel, ISO, aperture, shutter speed, focal length, GPS, orientation
- ✅ Store in blob metadata for both photos and thumbnails
- ✅ Convert to blob index tags for fast filtering (camera, lens, dateTaken)
- ✅ Handle missing EXIF gracefully with try-catch and console.warn
- ✅ RAW file preview extraction using exiftool.extractPreview()
- ✅ Correct image dimensions from RAW files (6000x4000 vs thumbnail 300x200)

**Implemented EXIF Fields:**
```typescript
{
  // Blob Metadata (stored on both photo and thumbnail)
  iso: string;                    // "400"
  aperture: string;               // "f/8"
  shutterSpeed: string;           // "1/40"
  focalLength: string;            // "15mm"
  artist: string;                 // Artist name
  copyright: string;              // Copyright info
  width: string;                  // Actual RAW dimensions (6000)
  height: string;                 // Actual RAW dimensions (4000)
  
  // Blob Tags (for filtering)
  camera: string;                 // "Canon-EOS-M50m2"
  lens: string;                   // "EF-M15-45mm-f3.5-6.3-IS-STM"
  dateTaken: string;              // "2025-08-24"
}
```

**RAW File Support:**
- ✅ CR3 (Canon EOS R series, M50m2) - Tested successfully
- ✅ CR2 (Canon 5D, 6D, etc.)
- ✅ NEF (Nikon)
- ✅ ARW (Sony)
- ✅ RAF (Fujifilm)
- ✅ ORF (Olympus)
- ✅ RW2 (Panasonic)
- ✅ DNG (Adobe Universal RAW)
- ✅ PEF (Pentax)

**Technical Details:**
- exifr: Used for JPEG/TIFF files (fast, lightweight)
- exiftool-vendored: Used for RAW files (includes binary, no separate install needed)
- Thumbnail format: Always JPEG (.jpg extension) regardless of source format
- Temp file handling: Write RAW to tmpdir(), extract preview, cleanup
- Type conversions: ExifDateTime → Date, string fractions → numbers

**Test Results:**
```bash
# JPEG test
✅ Full EXIF extraction: Canon EOS M50m2, EF-M15-45mm, ISO 400, f/8, 1/40s, 15mm

# CR3 RAW test  
✅ Preview extraction: 28.8MB CR3 → 300px JPEG thumbnail
✅ EXIF extraction: Camera, lens, all settings
✅ Correct dimensions: 6000x4000 (RAW) vs 300x200 (thumbnail)
✅ Blob tags applied to both photo and thumbnail
✅ Metadata on both photo and thumbnail
```

**Acceptance Criteria:**
- ✅ EXIF extracted from JPEG files
- ✅ EXIF extracted from RAW files (CR3, NEF, ARW, etc.)
- ✅ Thumbnails generated from RAW previews
- ✅ Correct dimensions stored (RAW dimensions, not thumbnail dimensions)
- ✅ Blob tags for fast filtering
- ✅ Graceful handling of missing EXIF
- ✅ Thumbnails always in JPEG format
- ✅ Full metadata on both photos and thumbnails

**Next:** Priority 3.9 (Sidecar JSON) - Optional, can defer for MVP

---

### Sidecar JSON Metadata Files (Priority 3.9)
**Why Important:**
- Overcome Azure Blob metadata 8KB limit
- Store unlimited EXIF data, AI tags, user annotations
- Easy to query without reading blob metadata
- Can be updated independently of the image
- Standard pattern in photo management (like `.xmp` files)

**Implementation Strategy:**
Create a new container `photo-metadata` with JSON files alongside photos:
```
photos/photo-123.jpg → photo-metadata/photo-123.json
```

**JSON Structure:**
```typescript
{
  "id": "photo-123.jpg",
  "originalFilename": "IMG_1234.jpg",
  "uploadDate": "2025-11-01T05:00:00Z",
  "processedDate": "2025-11-01T05:00:05Z",
  "size": 2808136,
  "dimensions": { "width": 4032, "height": 3024 },
  "format": "jpeg",
  
  // EXIF data (unlimited fields)
  "exif": {
    "dateTaken": "2025-10-18T23:06:34Z",
    "camera": { "make": "Google", "model": "Pixel 8 Pro" },
    "lens": "4.38mm f/1.8",
    "settings": { "iso": 100, "aperture": "f/1.8", "shutter": "1/125" },
    "gps": { 
      "latitude": 37.7749, 
      "longitude": -122.4194,
      "altitude": 10,
      "location": "San Francisco, CA"
    },
    "orientation": 1
  },
  
  // AI-generated metadata
  "ai": {
    "tags": ["sunset", "beach", "ocean", "people"],
    "faces": { "count": 2, "ids": ["face-abc", "face-def"] },
    "objects": ["person", "dog", "surfboard"],
    "scene": "outdoor",
    "colors": ["#FF6B35", "#F7931E", "#004E89"]
  },
  
  // User-added metadata
  "user": {
    "title": "Sunset at Ocean Beach",
    "description": "Family vacation with friends",
    "album": "California 2025",
    "favorite": true,
    "rating": 5,
    "tags": ["vacation", "family", "beach"],  // ← Unlimited custom text tags
    "people": ["John", "Sarah"],              // ← People in photo (unlimited)
    "notes": "Best sunset of the trip!"
  },
  
  // Processing history
  "processing": {
    "thumbnail": { "width": 300, "size": 13071 },
    "edits": ["cropped", "color-corrected"],
    "versions": [
      { "date": "2025-11-01", "type": "original" },
      { "date": "2025-11-02", "type": "edited" }
    ]
  }
}
```

**Advantages:**
- ✅ No size limits on metadata
- ✅ Structured, queryable JSON
- ✅ Easy to backup/export entire photo collection
- ✅ Can update metadata without touching the image
- ✅ Enable rich search and filtering
- ✅ Support photo editing history
- ✅ **No database required - keeps architecture simple**

**Azure Blob Index Tags for Fast Queries:**
Azure Blob Storage supports up to 10 index tags per blob (key-value pairs):

**Final Tag Schema (10 tags - all slots used):**
```typescript
// Set blob index tags for fast filtering
await blobClient.setTags({
  // Photo date (1 tag) - CRITICAL for sorting/filtering
  "dateTaken": "2025-10-30",           // YYYY-MM-DD format (from EXIF or upload date)
  
  // Equipment metadata (2 tags)
  "camera": "Canon-5D-Mark-IV",        // Camera make+model (no spaces)
  "lens": "50mm-f1.4",                 // Lens info (simplified, no spaces)
  
  // Location (2 tags)
  "location": "San-Francisco-CA",      // City/region (simplified, no spaces)
  "hasGPS": "true",                    // Boolean: has GPS coordinates (enables map view filter)
  
  // User preferences (1 tag)
  "rating": "0",                       // 0-5 star rating (string: "0", "1", "2", "3", "4", "5")
  
  // Custom user tags (3 tags) - Most important user-defined tags
  "customTag1": "vacation",            // Primary custom tag
  "customTag2": "family",              // Secondary custom tag
  "customTag3": "beach",               // Tertiary custom tag
  
  // System tags (1 tag)
  "favorite": "false",                 // User marked as favorite
});

// Author stored in blob path prefix (not as tag):
// photos/john.doe@example.com/uuid-12345.jpg
// thumbnails/john.doe@example.com/uuid-12345.jpg

// Query examples with operators (=, >, <, >=, <=)
const queries = [
  // Date range queries (YYYY-MM-DD format - lexicographic comparison works!)
  "dateTaken >= '2025-01-01' AND dateTaken <= '2025-12-31'",  // All 2025 photos
  "dateTaken >= '2025-10-01' AND dateTaken <= '2025-10-31'",  // October 2025
  "dateTaken >= '2024-06-01'",                                // Photos since June 2024
  "dateTaken = '2025-10-30'",                                 // Exact date
  
  // Equipment queries
  "camera = 'Canon-5D-Mark-IV'",                        // Specific camera
  "lens = '50mm-f1.4'",                                 // Specific lens
  "camera = 'Canon-5D-Mark-IV' AND lens = '50mm-f1.4'", // Camera + lens combo
  
  // Location queries
  "location = 'San-Francisco-CA'",                      // Photos from SF
  "location = 'Paris-France' AND dateTaken >= '2025-01-01'", // Paris in 2025
  "hasGPS = 'true'",                                    // All photos with GPS coordinates
  "hasGPS = 'true' AND dateTaken >= '2025-01-01'",      // 2025 photos with GPS (for map view)
  
  // Rating queries
  "rating >= '4'",                                      // 4-5 star photos
  "rating = '5'",                                       // Only 5-star
  "rating >= '3' AND dateTaken >= '2025-01-01'",        // 3+ stars from 2025
  
  // Custom tag queries (search across all 3 tag slots)
  "customTag1 = 'vacation' OR customTag2 = 'vacation' OR customTag3 = 'vacation'",  // Has 'vacation' tag
  "(customTag1 = 'vacation' OR customTag2 = 'vacation' OR customTag3 = 'vacation') AND rating >= '4'",  // High-rated vacation photos
  
  // Combined queries
  "camera = 'Canon-5D-Mark-IV' AND rating >= '4'",      // Great photos from Canon 5D
  "dateTaken >= '2025-10-01' AND location = 'Paris-France' AND favorite = 'true'",  // October Paris favorites
  "hasGPS = 'true' AND rating >= '4'",                  // High-rated photos with GPS (great travel photos)
  
  // User preference filters
  "favorite = 'true'",                                  // All favorites
  "favorite = 'true' AND rating >= '4'",                // High-rated favorites
];

// For per-user queries, list blobs by prefix:
const userPhotos = containerClient.listBlobsByHierarchy("/", {
  prefix: "photos/john.doe@example.com/"
});

// Then apply blob tag filters on the user's photos:
const filteredQuery = "dateTaken >= '2025-01-01' AND rating >= '4'";
// Note: Blob tag queries search across ALL blobs, so include user in path when retrieving

// Fast query across all blobs
const results = containerClient.findBlobsByTags(tagQuery);
```

**Tag Design Rationale:**
- ✅ `dateTaken` as `YYYY-MM-DD` enables precise date range queries (lexicographic comparison works perfectly)
- ✅ `camera` and `lens` for equipment-based searches (essential for photographers)
- ✅ `location` simplified (detailed GPS coordinates in JSON)
- ✅ `hasGPS` flag for quick "mappable photos" filter (enables map view, travel photo collections)
- ✅ `rating` as string "0"-"5" enables range queries (`rating >= '4'` for high-rated photos)
- ✅ `customTag1`, `customTag2`, `customTag3` for user's top 3 most important tags
- ✅ `favorite` for starred photos (quick filter)
- ✅ **`author` moved to blob path prefix** (`photos/john.doe/uuid.jpg`) - saves a tag slot!
- ✅ No spaces in values (use hyphens: "Canon-5D-Mark-IV" not "Canon 5D Mark IV")
- ✅ All 10 slots used efficiently - no waste!

**Author Storage Strategy:**
- **Blob path:** `photos/{author}/{uuid}.jpg` and `thumbnails/{author}/{uuid}.jpg`
- **Benefits:** 
  - Natural isolation per user
  - Easy to list all photos for a user: `listBlobsByHierarchy(prefix: "photos/john.doe/")`
  - Freed up one blob tag slot for `hasGPS` (important for map view)
- **For multi-user filtering:** List by prefix first, then apply blob tag queries

**Tag Limitations:**
- Max 10 tags per blob
- Tag values are strings only (no native dates/numbers)
- Tag keys max 128 chars, values max 256 chars
- Queries use string comparison (but YYYY-MM format works for date ranges)

**Combined Approach (Final Design):**
1. **Blob Index Tags** (10 tags - ALL used): Fast filtering for common queries
   - **Date:** `dateTaken` (YYYY-MM-DD for precise range queries)
   - **Equipment:** `camera`, `lens` (essential for photographers)
   - **Location:** `location` (city/region)
   - **Quality:** `rating` (0-5 stars)
   - **Custom:** `customTag1`, `customTag2`, `customTag3` (user's top 3 tags)
   - **System:** `author`, `favorite`
   - Enables efficient queries without scanning all JSON files
   
2. **Sidecar JSON** (unlimited): Full metadata storage
   - Complete EXIF data (GPS coordinates, camera settings, orientation)
   - AI tags (unlimited computer vision tags)
   - User notes (unlimited custom tags beyond the top 3)
   - Processing history
   - Read when displaying photo details
   
3. **Custom Tag Strategy:**
   - **Top 3 tags** → Blob index tags (fast search via `customTag1/2/3 = 'vacation'`)
   - **All tags** → JSON (unlimited storage)
   - User sees ALL tags in UI, but only top 3 are instantly searchable
   
4. **No Database Needed**: 
   - List photos: Query blob index tags (instant)
   - Show details: Read JSON file (fast)
   - Update metadata: Update JSON + update blob tags

**Custom Tag Search Strategy:**

**Option 1: Client-side filtering (Simple, works for small collections)**
```typescript
// Get all photos via blob tag query (fast)
const photos = await queryByBlobTags("year = '2025'");

// Load JSON metadata for each photo (parallel)
const metadata = await Promise.all(
  photos.map(p => loadJsonMetadata(p.id))
);

// Filter by custom tags in memory
const filtered = metadata.filter(m => 
  m.user.tags.includes("vacation")
);
```
- ✅ Simple, no extra infrastructure
- ✅ Works well for <1000 photos
- ❌ Slower for large collections (need to read all JSON files)

**Option 2: Azure Cognitive Search (Advanced, for large collections)**
```typescript
// Index all JSON metadata files
// Enable full-text search across custom tags, titles, descriptions
// Fast queries: "Find photos tagged 'vacation' OR 'beach'"
```
- ✅ Lightning fast for millions of photos
- ✅ Full-text search, autocomplete, fuzzy matching
- ❌ Additional cost (~$75/month for basic tier)
- ❌ More complex setup

**Recommendation for MVP:** 
- Start with **Option 1** (JSON + client-side filtering)
- Add **Option 2** (Cognitive Search) later if collection grows large

**Implementation Tasks:**
1. Create `photo-metadata` container in storage account
2. Update `process-image` function to write JSON file AND set blob tags
3. Update `get-photos` API to query by tags, then read JSON for details
4. Add API endpoint for updating metadata (JSON + tags)
5. Add support for user-defined custom tags in JSON (unlimited)
6. Enable tag-based filtering in frontend (client-side or server-side)

**Storage Cost:**
- JSON files: ~1-5KB each (negligible compared to images)
- Blob index tags: Free (included with blob storage)
- Can use Cool tier for older metadata

**Query Performance:**
- Blob tag queries: Very fast, indexed by Azure
- JSON file reads: Only when showing photo details
- No database to manage, backup, or pay for

**Estimated Time:** 3-4 hours

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
- Using Azure Functions v4 programming model (function.json + entryPoint)
- @azure/functions v4.5.0 package
- Parameter order: `request, context` for HTTP triggers, `blob, context` for blob triggers
- See `.github/copilot-instructions.md` for comprehensive v4 guidelines

**Alternatives Considered:**
- JavaScript (simpler but less type-safe)
- Python (good but Node.js has better Azure Functions tooling)
- Azure Functions v3 programming model (decided to use v4 for consistency and modern features)

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
