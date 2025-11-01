# Testing the Image Processing Function

This guide explains how to test the `process-image` function locally.

## Prerequisites

1. ✅ Azure Functions Core Tools installed
2. ✅ Backend built (`npm run build`)
3. ✅ `local.settings.json` configured with storage connection string
4. ✅ Azure Storage containers created (landing-zone, photos, thumbnails)
5. ✅ A test JPEG image file

## Testing Steps

### 1. Start the Functions Runtime

In Terminal 1:
```bash
cd backend
func start
```

You should see both functions loaded:
- `generate-sas-token` (HTTP trigger)
- `process-image` (Blob trigger)

### 2. Upload a Test Image

In Terminal 2, you have two options:

#### Option A: Use the test script

```bash
cd backend
# Place a test image named 'test-image.jpg' in the backend directory
./test-process-image.sh
```

#### Option B: Manual upload with Azure CLI

```bash
# Get your storage account name
STORAGE_ACCOUNT=$(jq -r '.storageAccountName' .azure/dev-outputs.json)

# Upload an image
az storage blob upload \
  --account-name $STORAGE_ACCOUNT \
  --container-name landing-zone \
  --name test-upload.jpg \
  --file /path/to/your/test-image.jpg \
  --auth-mode key
```

### 3. Watch the Function Logs

In Terminal 1 (where `func start` is running), you should see:

```
[2025-10-31T...] Executing 'Functions.process-image' (Reason='New blob detected...', Id=...)
[2025-10-31T...] Processing image: test-upload.jpg
[2025-10-31T...] Image metadata: {"width":4032,"height":3024,"format":"jpeg","size":2048576}
[2025-10-31T...] Generating thumbnail (300px width)...
[2025-10-31T...] Copying original to photos/test-upload.jpg...
[2025-10-31T...] Copying thumbnail to thumbnails/test-upload.jpg...
[2025-10-31T...] Deleting from landing-zone/test-upload.jpg...
[2025-10-31T...] Successfully processed image: test-upload.jpg
[2025-10-31T...] Executed 'Functions.process-image' (Succeeded, Id=..., Duration=1234ms)
```

### 4. Verify Results

Check that files were copied correctly:

```bash
# List files in photos container
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name photos \
  --auth-mode key \
  --output table

# List files in thumbnails container
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name thumbnails \
  --auth-mode key \
  --output table

# Verify landing-zone is empty (file should be deleted)
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name landing-zone \
  --auth-mode key \
  --output table
```

### 5. Download and Verify Thumbnail

```bash
# Download the thumbnail
az storage blob download \
  --account-name $STORAGE_ACCOUNT \
  --container-name thumbnails \
  --name test-upload.jpg \
  --file downloaded-thumbnail.jpg \
  --auth-mode key

# Check thumbnail dimensions (should be ~300px wide)
identify downloaded-thumbnail.jpg  # If ImageMagick installed
# OR
file downloaded-thumbnail.jpg
```

## Expected Behavior

### ✅ Success Case:
1. Function triggers automatically when blob uploaded to landing-zone
2. Image metadata extracted and logged
3. Thumbnail generated (300px width, maintains aspect ratio)
4. Original copied to `photos/` with metadata
5. Thumbnail copied to `thumbnails/` with metadata
6. Source blob deleted from `landing-zone`

### ⚠️ Error Case:
1. Function triggers
2. Error occurs during processing
3. **Source blob remains in landing-zone** (for retry)
4. Error logged in function output

## Troubleshooting

### Function doesn't trigger

**Problem:** No logs appear after uploading

**Solutions:**
- Check that `func start` is running
- Verify `StorageConnectionString` in `local.settings.json`
- Ensure containers exist: `az storage container list --account-name ...`
- Check Azure Storage emulator is not running (conflicts with cloud storage)

### "Sharp" errors

**Problem:** `Error: Cannot find module 'sharp'` or sharp binary errors

**Solutions:**
```bash
# Reinstall sharp
cd backend
npm uninstall sharp
npm install sharp

# Rebuild
npm run build
```

### Image processing fails

**Problem:** Function triggers but fails to process

**Solutions:**
- Check image format (JPEG, PNG supported)
- Verify image is not corrupted
- Check file size (very large images may timeout)
- Review function logs for specific error

### Blob not deleted from landing-zone

**Problem:** Blob remains after successful processing

**Solutions:**
- Check function logs for deletion errors
- Verify storage account permissions
- Check if error occurred before deletion step

## Test Image Requirements

- **Format:** JPEG or PNG recommended
- **Size:** < 10MB for local testing
- **Dimensions:** Any (function handles all sizes)
- **Filename:** Avoid special characters (use alphanumeric, dash, underscore)

## Clean Up Test Data

After testing:

```bash
# Delete all test files
az storage blob delete-batch \
  --account-name $STORAGE_ACCOUNT \
  --source photos \
  --auth-mode key

az storage blob delete-batch \
  --account-name $STORAGE_ACCOUNT \
  --source thumbnails \
  --auth-mode key

az storage blob delete-batch \
  --account-name $STORAGE_ACCOUNT \
  --source landing-zone \
  --auth-mode key
```

## Next Steps

Once local testing works:
1. Test with different image formats (JPEG, PNG)
2. Test with various image sizes
3. Test error handling (upload corrupted file)
4. Deploy to Azure
5. Test end-to-end workflow with frontend
