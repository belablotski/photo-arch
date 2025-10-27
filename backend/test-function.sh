#!/bin/bash

# Test script for SAS Token Generation Function

echo "=========================================="
echo "Testing SAS Token Generation"
echo "=========================================="
echo ""

# Check if function is running
echo "Checking if Azure Functions is running on port 7071..."
if ! curl -s http://localhost:7071 > /dev/null 2>&1; then
    echo "❌ Function not running!"
    echo ""
    echo "Please start the function first:"
    echo "  Terminal 1: cd backend && func start"
    echo "  Terminal 2: ./test-function.sh"
    echo ""
    exit 1
fi

echo "✅ Function is running!"
echo ""

# Test 1: Generate token for a photo
echo "Test 1: Generate upload token for test-photo.jpg"
echo ""

RESPONSE=$(curl -X POST http://localhost:7071/api/generate-upload-token \
  -H "Content-Type: application/json" \
  -d '{"filename": "test-photo.jpg"}' \
  -s -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Success! HTTP $HTTP_CODE"
    echo ""
    echo "$BODY" | jq '.'
    echo ""
    echo "=========================================="
    echo "✅ Test PASSED!"
    echo "=========================================="
    echo ""
    echo "The function successfully generated a SAS token."
    echo "You can now use the uploadUrl to upload a file:"
    echo ""
    echo "  UPLOAD_URL=\$(echo '$BODY' | jq -r '.uploadUrl')"
    echo "  curl -X PUT \"\$UPLOAD_URL\" \\"
    echo "    -H \"x-ms-blob-type: BlockBlob\" \\"
    echo "    -H \"Content-Type: image/jpeg\" \\"
    echo "    --data-binary @path/to/photo.jpg"
    echo ""
else
    echo "❌ Failed! HTTP $HTTP_CODE"
    echo ""
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    exit 1
fi
