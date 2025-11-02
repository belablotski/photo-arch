# Get Photos Function

HTTP-triggered Azure Function that retrieves photos from storage with filtering and pagination support.

## Endpoint

```
GET /api/photos
```

## Query Parameters

### Basic Parameters
- `limit` (optional): Number of photos to return per page (default: 20)
- `continuationToken` (optional): Token for pagination

### Filter Parameters (Blob Tags)
- `author`: Filter by photo owner (exact match)
  - Example: `author=john.doe`
- `dateTaken`: Filter by date (supports operators: =, >=, <=, >, <)
  - Example: `dateTaken=2025-10-30` (exact date)
  - Example: `dateTaken>=2025-01-01` (photos since Jan 1, 2025)
  - Example: `dateTaken<=2025-12-31` (photos before end of 2025)
- `camera`: Filter by camera (exact match)
  - Example: `camera=Canon-5D-Mark-IV`
- `lens`: Filter by lens (exact match)
  - Example: `lens=50mm-f1.4`
- `location`: Filter by location (exact match)
  - Example: `location=San-Francisco-CA`
- `rating`: Filter by rating (supports operators: =, >=, <=, >, <)
  - Example: `rating>=4` (4-5 star photos)
  - Example: `rating=5` (only 5-star photos)
- `customTag1`, `customTag2`, `customTag3`: Filter by custom tags
  - Example: `customTag1=vacation`
- `favorite`: Filter by favorite status (true/false)
  - Example: `favorite=true`

## Examples

### Basic Usage

**List all photos:**
```bash
curl "http://localhost:7071/api/photos"
```

**List photos by author:**
```bash
curl "http://localhost:7071/api/photos?author=john.doe"
```

**List with pagination:**
```bash
curl "http://localhost:7071/api/photos?limit=10"
```

**Next page:**
```bash
curl "http://localhost:7071/api/photos?limit=10&continuationToken=abc123"
```

### Filtering Examples

**Photos from 2025:**
```bash
curl "http://localhost:7071/api/photos?dateTaken>=2025-01-01&dateTaken<=2025-12-31"
```

**High-rated photos (4-5 stars):**
```bash
curl "http://localhost:7071/api/photos?rating>=4"
```

**Photos from specific camera:**
```bash
curl "http://localhost:7071/api/photos?camera=Canon-5D-Mark-IV"
```

**Vacation photos:**
```bash
curl "http://localhost:7071/api/photos?customTag1=vacation"
```

**Favorite photos:**
```bash
curl "http://localhost:7071/api/photos?favorite=true"
```

**Combined filters (John's high-rated travel photos from 2025):**
```bash
curl "http://localhost:7071/api/photos?author=john.doe&dateTaken>=2025-01-01&rating>=4&location=Paris"
```

## Response Format

```json
{
  "photos": [
    {
      "id": "uuid-12345.jpg",
      "originalFilename": "IMG_1234.jpg",
      "thumbnailUrl": "https://...blob.core.windows.net/thumbnails/john.doe/uuid-12345.jpg?sv=...",
      "photoUrl": "https://...blob.core.windows.net/photos/john.doe/uuid-12345.jpg?sv=...",
      "uploadDate": "2025-11-01T05:00:00.000Z",
      "size": 2808136,
      "dimensions": {
        "width": 4032,
        "height": 3024
      },
      "format": "jpeg",
      "tags": {
        "dateTaken": "2025-10-30",
        "camera": "Canon-5D-Mark-IV",
        "lens": "50mm-f1.4",
        "location": "San-Francisco-CA",
        "hasGPS": "true",
        "rating": "5",
        "customTag1": "vacation",
        "customTag2": "family",
        "customTag3": "beach",
        "favorite": "true"
      }
    }
  ],
  "continuationToken": "eyJDb250aW51YXRpb25Ub2tlbiI6bnVsbCwiUmVzdWx0cyI6W119",
  "hasMore": true,
  "totalReturned": 10
}
```

## Response Fields

- `photos`: Array of photo objects
- `continuationToken`: Token for retrieving next page (null if no more pages)
- `hasMore`: Boolean indicating if more photos are available
- `totalReturned`: Number of photos in current response

### Photo Object Fields

- `id`: Unique identifier (filename)
- `originalFilename`: Original filename when uploaded
- `thumbnailUrl`: SAS URL for thumbnail (1 hour expiration)
- `photoUrl`: SAS URL for full-size photo (1 hour expiration)
- `uploadDate`: ISO 8601 timestamp
- `size`: File size in bytes
- `dimensions`: Width and height in pixels
- `format`: Image format (jpeg, png, etc.)
- `tags`: Blob index tags (used for filtering)

## Implementation Notes

1. **User Isolation**: Photos are stored with author prefix: `photos/{author}/{filename}`
2. **SAS URLs**: Generated with 1-hour expiration for security
3. **Pagination**: Uses Azure's continuation tokens for efficient paging
4. **Tag Filtering**: Client-side filtering based on blob tags (for MVP)
5. **CORS**: Currently allows all origins (`*`) - TODO: configure properly for production

## Future Enhancements

1. **Authentication**: Extract author from Azure AD token instead of query parameter
2. **Blob Tag Queries**: Use `findBlobsByTags()` for more efficient filtering
3. **Sidecar JSON**: Load detailed metadata from JSON files
4. **Performance**: Cache SAS tokens, optimize for large collections
5. **CORS**: Configure proper allowed origins

## Testing

See test script: `backend/test-get-photos.sh`

## Dependencies

- `@azure/storage-blob`: Azure Blob Storage SDK
- `@azure/functions`: Azure Functions SDK

## Environment Variables

- `StorageConnectionString`: Azure Storage connection string
