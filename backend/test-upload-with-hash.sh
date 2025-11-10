#!/bin/bash

# Test script for uploading a photo with simple filename
# Landing zone uses original filename, process-image adds content hash for archive

set -e

# Configuration
BASE_URL="http://localhost:7071"
PHOTO_FILE="${1:-test_photos/PXL_20251018_230634086.jpg}"

if [ ! -f "$PHOTO_FILE" ]; then
  echo "❌ Error: Photo file not found: $PHOTO_FILE"
  echo "Usage: $0 [path/to/photo.jpg]"
  exit 1
fi

echo "🧪 Testing Simple Photo Upload"
echo "==============================="
echo "Photo: $PHOTO_FILE"
echo ""

# Step 1: Get filename
FILENAME=$(basename "$PHOTO_FILE")
echo "📝 Step 1: Original filename: $FILENAME"
echo ""

# Step 2: Request SAS token (no hash needed!)
echo "🔑 Step 2: Requesting SAS token..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/generate-upload-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"filename\": \"$FILENAME\",
    \"contentType\": \"image/jpeg\"
  }")

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Extract upload URL and blob name
UPLOAD_URL=$(echo "$RESPONSE" | jq -r '.uploadUrl')
BLOB_NAME=$(echo "$RESPONSE" | jq -r '.blobName')

if [ "$UPLOAD_URL" == "null" ] || [ -z "$UPLOAD_URL" ]; then
  echo "❌ Error: Failed to get upload URL"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

echo "📦 Landing zone blob name: $BLOB_NAME"
echo ""

# Step 3: Upload file to blob storage
echo "☁️  Step 3: Uploading to Azure Blob Storage..."
curl -X PUT "$UPLOAD_URL" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@$PHOTO_FILE" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "✅ Upload complete!"
echo ""
echo "Expected behavior:"
echo "  1. File uploaded to landing-zone as: $BLOB_NAME"
echo "  2. Process-image function triggers automatically"
echo "  3. Content hash calculated server-side from file content"
echo "  4. Photo stored in 'photos' as: ${BLOB_NAME%.*}_<hash8chars>.${BLOB_NAME##*.}"
echo "  5. Thumbnail generated in 'thumbnails' with same hash-based name"
echo "  6. Original filename '$FILENAME' preserved in metadata"
echo "  7. Landing-zone file deleted after processing"
echo "  8. If same photo uploaded again, duplicate is detected and skipped"
echo ""
echo "Check Azure Functions logs to see processing..."
