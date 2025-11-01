# Process Image Function

Azure Function that automatically processes images uploaded to the `landing-zone` container.

## Trigger

- **Type:** Blob Trigger
- **Container:** `landing-zone`
- **Pattern:** `{name}` (any blob)

## Functionality

1. **Triggered** when a new blob is uploaded to `landing-zone`
2. **Analyzes** image metadata (dimensions, format, size)
3. **Generates** thumbnail (300px width, maintains aspect ratio)
4. **Copies** original image to `photos` container with metadata
5. **Copies** thumbnail to `thumbnails` container
6. **Deletes** from `landing-zone` only after successful processing
7. **Error Handling:** On failure, leaves blob in `landing-zone` for retry

## Configuration

Environment variables in `local.settings.json`:

```json
{
  "StorageConnectionString": "<connection-string>",
  "LANDING_ZONE_CONTAINER": "landing-zone",
  "PHOTOS_CONTAINER": "photos",
  "THUMBNAILS_CONTAINER": "thumbnails",
  "THUMBNAIL_WIDTH": "300"
}
```

## Metadata Added

### Original Photo Metadata
- `originalName`: Original filename
- `uploadDate`: ISO timestamp
- `width`: Image width in pixels
- `height`: Image height in pixels
- `format`: Image format (jpeg, png, etc.)
- `size`: File size in bytes

### Thumbnail Metadata
- `originalName`: Original filename
- `isThumbnail`: "true"
- `thumbnailWidth`: Thumbnail width in pixels

## Image Processing

- **Library:** Sharp (fast, native C++)
- **Thumbnail:** Resizes to 300px width (configurable)
- **Aspect Ratio:** Maintained automatically
- **Quality:** 85% JPEG, progressive encoding
- **Behavior:** Won't upscale images smaller than target width

## Error Handling

- Logs detailed error information
- Leaves blob in `landing-zone` on failure
- Azure Functions will retry automatically
- Manual intervention possible if needed

## Testing

Upload a test image to the `landing-zone` container:

```bash
# Using Azure CLI
az storage blob upload \
  --account-name <account-name> \
  --container-name landing-zone \
  --name test-image.jpg \
  --file /path/to/test.jpg \
  --auth-mode key

# Check logs
func start  # Watch for processing logs
```

## Monitoring

Watch for:
- Successful processing logs
- Image metadata in output
- Thumbnail generation confirmation
- Cleanup confirmation
- Any errors or failures
