#!/bin/bash

# Test script for process-image function
# This script uploads a test image to the landing-zone container

set -e  # Exit on error

echo "📸 Testing Image Processing Function"
echo "====================================="
echo ""

# Check if test image exists
if [ ! -f "test-image.jpg" ]; then
    echo "❌ test-image.jpg not found!"
    echo "   Please add a test JPEG image named 'test-image.jpg' to the backend directory"
    exit 1
fi

# Load storage account name from .azure/dev-outputs.json
if [ ! -f "../.azure/dev-outputs.json" ]; then
    echo "❌ .azure/dev-outputs.json not found!"
    echo "   Run deployment first: cd ../scripts && ./deploy.sh dev"
    exit 1
fi

STORAGE_ACCOUNT=$(jq -r '.storageAccountName' ../.azure/dev-outputs.json)
echo "Storage Account: $STORAGE_ACCOUNT"
echo ""

# Upload test image
echo "📤 Uploading test-image.jpg to landing-zone container..."
az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" \
    --container-name landing-zone \
    --name "test-$(date +%s)-test-image.jpg" \
    --file test-image.jpg \
    --auth-mode key \
    --overwrite

echo ""
echo "✅ Image uploaded!"
echo ""
echo "🔍 Watch the function logs (in the terminal running 'func start')"
echo "   You should see:"
echo "   - Processing image: test-*.jpg"
echo "   - Image metadata"
echo "   - Generating thumbnail"
echo "   - Copying to photos and thumbnails"
echo "   - Deleting from landing-zone"
echo ""
echo "🔎 Verify results:"
echo "   az storage blob list --account-name $STORAGE_ACCOUNT --container-name photos --auth-mode key"
echo "   az storage blob list --account-name $STORAGE_ACCOUNT --container-name thumbnails --auth-mode key"
echo "   az storage blob list --account-name $STORAGE_ACCOUNT --container-name landing-zone --auth-mode key"
