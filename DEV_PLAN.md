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
- Dependencies installed (@azure/functions, @azure/storage-blob)
- SAS Token Generation function implemented and tested locally
- Local development environment configured
- Security: connection strings properly gitignored

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

**Next:** Deploy to Azure (optional, can do after Priority 2)

---

### 🔥 **PRIORITY 2: Image Processing Function**

**Why Critical:**
- Completes the upload workflow
- Moves photos from temporary to permanent storage
- Prevents data accumulation in landing-zone
- Generates thumbnails for browsing

**Implementation:**
```
backend/functions/process-image/
├── index.ts          # Blob trigger handler
├── function.json     # Blob trigger configuration
├── thumbnail.ts      # Image resizing logic
└── README.md         # Function documentation
```

**Functionality:**
1. Blob-triggered on landing-zone uploads
2. Generate thumbnail (300px width, maintain aspect ratio)
3. Copy original to `photos/` container
4. Copy thumbnail to `thumbnails/` container
5. Add metadata tags (size, dimensions, upload date)
6. **Delete from landing-zone ONLY after success**
7. Error handling: leave in landing-zone for retry

**Dependencies:**
- `@azure/storage-blob` SDK
- `sharp` (image processing library)

**Acceptance Criteria:**
- ✅ Triggers automatically on upload
- ✅ Generates thumbnail correctly
- ✅ Copies to permanent storage
- ✅ Cleans up landing-zone after success
- ✅ Retries on failure (file stays in landing-zone)

**Estimated Time:** 4-6 hours

---

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

**Alternatives Considered:**
- JavaScript (simpler but less type-safe)
- Python (good but Node.js has better Azure Functions tooling)

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
1. Run Azure Functions locally: `npm run start:functions`
2. Run frontend dev server: `npm run start:web`
3. Test against dev storage account

### Testing Strategy
1. **Unit Tests**: Each function in isolation
2. **Integration Tests**: End-to-end upload workflow
3. **Manual Testing**: Upload real photos, verify processing

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
3. ✅ Test locally with Postman
4. ✅ Deploy to Azure

**Short Term (Next Week):**
1. Implement Image Processing function
2. Test end-to-end upload workflow
3. Implement Photo Retrieval API
4. Basic frontend upload UI

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

**Last Updated:** October 27, 2025  
**Status:** Phase 2 (Priority 1) Complete, Starting Priority 2  
**Next Milestone:** Image Processing Function
