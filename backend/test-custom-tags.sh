#!/bin/bash

# Test script for uploading a photo with custom tags
# This tests that custom tags persist to blob index tags

set -e

# Configuration
BASE_URL="http://localhost:7071"
PHOTO_FILE="${1:-test_photos/PXL_20251018_230634086.jpg}"

if [ ! -f "$PHOTO_FILE" ]; then
  echo "❌ Error: Photo file not found: $PHOTO_FILE"
  echo "Usage: $0 [path/to/photo.jpg]"
  exit 1
fi

echo "🧪 Testing Photo Upload with Custom Tags"
echo "========================================="
echo "Photo: $PHOTO_FILE"
echo ""

# Step 1: Get filename
FILENAME=$(basename "$PHOTO_FILE")
echo "📝 Step 1: Original filename: $FILENAME"
echo ""

# Step 2: Request SAS token with custom tags
echo "🔑 Step 2: Requesting SAS token with custom tags..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/generate-upload-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"filename\": \"$FILENAME\",
    \"contentType\": \"image/jpeg\",
    \"metadata\": {
      \"author\": \"test-user\",
      \"location\": \"San Francisco\",
      \"customTag1\": \"vacation\",
      \"customTag2\": \"beach\",
      \"customTag3\": \"sunset\"
    }
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

# Step 3: Upload file to blob storage with metadata
echo "☁️  Step 3: Uploading to Azure Blob Storage with custom tags..."
curl -X PUT "$UPLOAD_URL" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: image/jpeg" \
  -H "x-ms-meta-author: test-user" \
  -H "x-ms-meta-location: San Francisco" \
  -H "x-ms-meta-customTag1: vacation" \
  -H "x-ms-meta-customTag2: beach" \
  -H "x-ms-meta-customTag3: sunset" \
  --data-binary "@$PHOTO_FILE" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "✅ Upload complete!"
echo ""
echo "Expected behavior:"
echo "  1. File uploaded to landing-zone with custom tags in metadata"
echo "  2. Process-image function triggers automatically"
echo "  3. Custom tags extracted from metadata: vacation, beach, sunset"
echo "  4. Blob index tags set on photos/thumbnails/previews containers"
echo "  5. Custom tags should be queryable via blob index"
echo ""
echo "⏳ Waiting 5 seconds for processing to complete..."
sleep 5
echo ""

# Step 4: Try to retrieve the photo and check tags
echo "🔍 Step 4: Checking if photo was processed with custom tags..."
GET_RESPONSE=$(curl -s "${BASE_URL}/api/photos?author=test-user&limit=5")

echo "Recent photos for test-user:"
echo "$GET_RESPONSE" | jq '.photos[] | {name: .name, customTag1: .customTag1, customTag2: .customTag2, customTag3: .customTag3}'
echo ""

# Check if our custom tags appear
HAS_VACATION=$(echo "$GET_RESPONSE" | jq -r '.photos[].customTag1' | grep -c "vacation" || echo "0")
HAS_BEACH=$(echo "$GET_RESPONSE" | jq -r '.photos[].customTag2' | grep -c "beach" || echo "0")
HAS_SUNSET=$(echo "$GET_RESPONSE" | jq -r '.photos[].customTag3' | grep -c "sunset" || echo "0")

if [ "$HAS_VACATION" -gt 0 ] && [ "$HAS_BEACH" -gt 0 ] && [ "$HAS_SUNSET" -gt 0 ]; then
  echo "✅ SUCCESS: Custom tags persisted correctly!"
  echo "   - customTag1: vacation ✓"
  echo "   - customTag2: beach ✓"
  echo "   - customTag3: sunset ✓"
else
  echo "❌ FAILED: Custom tags not found in blob index tags"
  echo "   - customTag1 (vacation): $([ "$HAS_VACATION" -gt 0 ] && echo "✓" || echo "✗")"
  echo "   - customTag2 (beach): $([ "$HAS_BEACH" -gt 0 ] && echo "✓" || echo "✗")"
  echo "   - customTag3 (sunset): $([ "$HAS_SUNSET" -gt 0 ] && echo "✓" || echo "✗")"
  echo ""
  echo "Check Azure Functions logs for errors."
fi
