#!/bin/bash

# Test script for Get Photos function
# Make sure Azure Functions is running: cd backend && func start

BASE_URL="http://localhost:7071/api/photos"

echo "🧪 Testing Get Photos API"
echo "=========================="
echo ""

# Test 1: Basic listing
echo "Test 1: List all photos (limit 10)"
echo "-----------------------------------"
curl -s "${BASE_URL}?limit=10" | jq '.'
echo ""
echo ""

# Test 2: List with limit 5
echo "Test 2: List 5 photos"
echo "---------------------"
curl -s "${BASE_URL}?limit=5" | jq '.photos | length'
echo ""
echo ""

# Test 3: Filter by author
echo "Test 3: Filter by author"
echo "------------------------"
curl -s "${BASE_URL}?author=default-user&limit=5" | jq '.photos[].tags.author'
echo ""
echo ""

# Test 4: Filter by date range
echo "Test 4: Filter by date range (2025)"
echo "-----------------------------------"
curl -s "${BASE_URL}?dateTaken>=2025-01-01&dateTaken<=2025-12-31" | jq '.photos[].tags.dateTaken'
echo ""
echo ""

# Test 5: Filter by rating
echo "Test 5: Filter by rating >= 4"
echo "------------------------------"
curl -s "${BASE_URL}?rating>=4" | jq '.photos[].tags.rating'
echo ""
echo ""

# Test 6: Filter by camera
echo "Test 6: Filter by camera"
echo "------------------------"
curl -s "${BASE_URL}?camera=Canon-5D-Mark-IV" | jq '.photos[].tags.camera'
echo ""
echo ""

# Test 7: Filter by custom tag
echo "Test 7: Filter by custom tag"
echo "-----------------------------"
curl -s "${BASE_URL}?customTag1=vacation" | jq '.photos[].tags.customTag1'
echo ""
echo ""

# Test 8: Filter by favorite
echo "Test 8: Filter by favorite"
echo "--------------------------"
curl -s "${BASE_URL}?favorite=true" | jq '.photos[].tags.favorite'
echo ""
echo ""

# Test 9: Combined filters
echo "Test 9: Combined filters (author + 2025 + rating >= 4)"
echo "----------------------------------------------"
curl -s "${BASE_URL}?author=${AUTHOR}&dateTaken>=2025-01-01&rating>=4" | jq '{count: (.photos | length), photos: [.photos[] | {id, rating: .tags.rating, date: .tags.dateTaken}]}'
echo ""
echo ""

# Test 10: Check pagination
echo "Test 10: Check pagination"
echo "-------------------------"
RESPONSE=$(curl -s "${BASE_URL}?author=${AUTHOR}&limit=2")
echo "First page:"
echo "$RESPONSE" | jq '{count: (.photos | length), hasMore, continuationToken: (.continuationToken // "null")}'
echo ""

CONTINUATION_TOKEN=$(echo "$RESPONSE" | jq -r '.continuationToken // empty')
if [ -n "$CONTINUATION_TOKEN" ]; then
  echo "Second page (using continuation token):"
  curl -s "${BASE_URL}?author=${AUTHOR}&limit=2&continuationToken=${CONTINUATION_TOKEN}" | jq '{count: (.photos | length), hasMore}'
else
  echo "No continuation token (all photos fit in one page)"
fi
echo ""

echo "✅ Tests complete!"
echo ""
echo "Note: These tests assume you have photos in the 'photos' container."
echo "Upload some test photos first using the upload workflow."
