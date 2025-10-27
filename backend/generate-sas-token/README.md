# Generate Upload Token Function

HTTP-triggered Azure Function that generates a time-limited SAS (Shared Access Signature) token for uploading photos to the landing-zone container.

## Endpoint

`POST /api/generate-upload-token`

## Request

```json
{
  "filename": "my-photo.jpg",
  "contentType": "image/jpeg"  // optional
}
```

## Response

**Success (200):**
```json
{
  "uploadUrl": "https://<storage-account>.blob.core.windows.net/landing-zone/1234567890-my-photo.jpg?sv=2023-01-03&...",
  "blobName": "1234567890-my-photo.jpg",
  "containerName": "landing-zone",
  "expiresAt": "2025-10-26T20:35:00.000Z"
}
```

**Error (400):**
```json
{
  "error": "Missing or invalid filename",
  "message": "Request body must include a valid filename string"
}
```

**Error (500):**
```json
{
  "error": "Internal server error",
  "message": "Error details..."
}
```

## How It Works

1. Validates the filename in the request
2. Sanitizes the filename to prevent directory traversal attacks
3. Generates a unique blob name with timestamp prefix
4. Creates a SAS token with:
   - Write-only permissions
   - 5-minute expiration (configurable)
   - Scoped to specific blob in landing-zone
5. Returns the complete upload URL

## Security Features

- **Write-only SAS**: Token can only write to the specific blob
- **Time-limited**: Expires after 5 minutes
- **Unique names**: Timestamp prevents overwrites
- **Sanitized filenames**: Prevents path traversal
- **No authentication yet**: TODO - Add Azure AD or API key auth

## Configuration

Environment variables in `local.settings.json`:

- `StorageConnectionString`: Azure Storage connection string
- `LANDING_ZONE_CONTAINER`: Container name (default: "landing-zone")
- `SAS_TOKEN_EXPIRY_MINUTES`: Token expiry time (default: 5)

## Testing

### With curl:

```bash
curl -X POST http://localhost:7071/api/generate-upload-token \
  -H "Content-Type: application/json" \
  -d '{"filename": "test-photo.jpg"}'
```

### Upload using the token:

```bash
# Get the uploadUrl from the response above
curl -X PUT "<uploadUrl>" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: image/jpeg" \
  --data-binary @my-photo.jpg
```

## Next Steps

- [ ] Add authentication (Azure AD or API keys)
- [ ] Add rate limiting
- [ ] Validate file size before generating token
- [ ] Support for multiple file uploads
- [ ] Add telemetry/monitoring
