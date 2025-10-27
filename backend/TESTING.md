# Testing the Backend Functions

## Prerequisites

- Azure Functions Core Tools installed (`func` command available)
- Storage account deployed and configured in `local.settings.json`

## Quick Test

### Terminal 1: Start the Function
```bash
cd backend
func start
```

Wait for:
```
Functions:
    generate-sas-token: [POST] http://localhost:7071/api/generate-upload-token
```

### Terminal 2: Run the Test
```bash
cd backend
./test-function.sh
```

Expected output:
```json
{
  "uploadUrl": "https://...",
  "blobName": "1730000000000-test-photo.jpg",
  "containerName": "landing-zone",
  "expiresAt": "2025-10-27T..."
}
```

## Manual Testing

### Test 1: Generate SAS Token

```bash
curl -X POST http://localhost:7071/api/generate-upload-token \
  -H "Content-Type: application/json" \
  -d '{"filename": "my-photo.jpg"}'
```

### Test 2: Upload a Real Photo

Save the `uploadUrl` from Test 1, then:

```bash
UPLOAD_URL="<paste-upload-url-here>"

curl -X PUT "$UPLOAD_URL" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: image/jpeg" \
  --data-binary @path/to/your/photo.jpg
```

### Test 3: Verify Upload in Azure

```bash
az storage blob list \
  --container-name landing-zone \
  --account-name <your-storage-account-name> \
  --output table
```

Or check in Azure Portal:
https://portal.azure.com → Storage Account → Containers → landing-zone

## Test Cases

### Valid Requests
- [x] Simple filename: `{"filename": "photo.jpg"}`
- [ ] Filename with spaces: `{"filename": "my photo.jpg"}` → Should sanitize to `my_photo.jpg`
- [ ] Long filename: 255 characters
- [ ] Special characters: `{"filename": "photo@#$.jpg"}` → Should sanitize

### Invalid Requests
- [ ] Missing filename: `{}` → Should return 400
- [ ] Empty filename: `{"filename": ""}` → Should return 400
- [ ] Non-string filename: `{"filename": 123}` → Should return 400

### Error Cases
- [ ] Invalid storage connection → Should return 500
- [ ] Storage account unreachable → Should return 500

## Troubleshooting

### "Function not running on port 7071"
- Make sure `func start` is running in another terminal
- Check for port conflicts: `lsof -i :7071`

### "StorageConnectionString not configured"
- Verify `local.settings.json` exists in `backend/`
- Check connection string format

### "Authentication failed"
- Verify storage account key in connection string
- Try regenerating the key in Azure Portal

### "EACCES" permission errors
- Use the globally installed `func` command
- Don't use `npm start` if it fails

## Performance Testing

Test token generation speed:
```bash
time curl -X POST http://localhost:7071/api/generate-upload-token \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.jpg"}'
```

Expected: < 200ms

## Next Steps

Once this function works:
1. [ ] Implement image processing function (Priority 2)
2. [ ] Test end-to-end upload workflow
3. [ ] Deploy to Azure Function App
