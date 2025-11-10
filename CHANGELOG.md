# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added (November 10, 2025)
- **Azure Functions v4 Migration** - Migrated entire backend from hybrid v3/v4 to pure v4 programming model
  - All functions now use `app.http()` and `app.storageBlob()` registration
  - Entry point: `src/app.ts` imports all functions
  - No more `function.json` files needed
  - Better TypeScript support and cleaner code structure
  - See `backend/V4_MIGRATION_COMPLETE.md` for migration details

- **Content-Hash Based Naming with Deduplication** (Priority 3.5)
  - Automatic filename collision prevention using SHA-256 content hashing
  - Archive storage uses `{filename}_{hash8chars}.{ext}` format (e.g., `DSC_0001_d1cf8277.jpg`)
  - Server-side hash calculation (no client complexity)
  - Automatic duplicate detection: same content = same hash = skipped
  - Original filename preserved in blob metadata for UI display
  - Landing zone keeps simple original filenames for easy upload
  - End-to-end test script: `backend/test-upload-with-hash.sh`

### Changed
- Updated project structure to v4 model: `backend/src/app.ts` and `backend/src/functions/*.ts`
- Improved documentation:
  - `backend/README.md` - Complete backend guide with v4 examples
  - `.github/copilot-instructions.md` - Updated to v4 programming model
  - `DEV_PLAN.md` - Marked Priority 3, 3.5, and v4 migration as complete
- Deleted old v3/hybrid function folders (migrated to v4 structure)

### Fixed
- HTTP request body parsing now uses `request.json()` properly in v4
- Query parameters accessed via `request.query.get('param')` instead of plain object
- Blob trigger metadata access via `context.triggerMetadata?.name`
- Eliminated "mixed function app" warning by removing old function folders

## [0.2.0] - November 2, 2025

### Added
- **Photo Retrieval API** (Priority 3)
  - GET `/api/photos` endpoint with pagination
  - Filtering by blob index tags (author, dateTaken, camera, rating, etc.)
  - Comparison operators for date and rating filters (>=, <=, >, <, =)
  - SAS URL generation for secure photo access (1 hour expiration)
  - Continuation token-based pagination

### Changed
- Process-image function now sets default blob tags for filtering
- Improved error handling and logging across all functions

## [0.1.0] - November 1, 2025

### Added
- **Image Processing Function** (Priority 2)
  - Automatic blob trigger on landing-zone uploads
  - Thumbnail generation with Sharp library (300px width)
  - Metadata extraction (dimensions, format, size)
  - Automatic cleanup after processing
  - Error handling: leaves blobs in landing-zone for retry
  
- **SAS Token Generation Function** (Priority 1)
  - POST `/api/generate-upload-token` endpoint
  - Write-only SAS tokens with 5-minute expiration
  - Filename sanitization for security
  - Input validation and error handling

### Infrastructure
- Azure Storage Account deployed with containers:
  - `landing-zone` - Temporary upload storage
  - `photos` - Permanent archive
  - `thumbnails` - Generated thumbnails
  - `$web` - Static website hosting
- Lifecycle policies configured
- Blob versioning and soft delete enabled

## [0.0.1] - October 26, 2025

### Added
- Initial project setup
- TypeScript configuration
- Azure Functions project structure
- Development environment setup
- Documentation: README, DESIGN, PRODUCT_DOCUMENT, DEV_PLAN

---

**Note:** This project follows [Semantic Versioning](https://semver.org/).
