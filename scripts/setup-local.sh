#!/bin/bash
set -e

# Photo Archive - Local Development Setup
# This script configures local environment for development

ENVIRONMENT=${1:-dev}
RESOURCE_GROUP="photo-archive-${ENVIRONMENT}-rg"

echo "=========================================="
echo "Photo Archive - Local Setup"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "=========================================="

# Check if deployment outputs exist
if [ ! -f ".azure/${ENVIRONMENT}-outputs.json" ]; then
    echo "Error: Deployment outputs not found."
    echo "Please run ./scripts/deploy.sh ${ENVIRONMENT} first."
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Installing jq..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y jq
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        echo "Please install jq manually: https://stedolan.github.io/jq/download/"
        exit 1
    fi
fi

# Read storage account name from outputs
STORAGE_ACCOUNT=$(jq -r '.storageAccountName' ".azure/${ENVIRONMENT}-outputs.json")

echo "Retrieving storage connection string..."
CONNECTION_STRING=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --output tsv)

# Create local.settings.json for Azure Functions
echo "Creating local.settings.json..."
cat > local.settings.json <<EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "$CONNECTION_STRING",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "StorageConnectionString": "$CONNECTION_STRING",
    "STORAGE_ACCOUNT_NAME": "$STORAGE_ACCOUNT",
    "ENVIRONMENT": "$ENVIRONMENT"
  }
}
EOF

# Create .env for frontend
echo "Creating .env file for frontend..."
cat > .env.local <<EOF
REACT_APP_ENVIRONMENT=$ENVIRONMENT
REACT_APP_STORAGE_ACCOUNT=$STORAGE_ACCOUNT
REACT_APP_API_BASE_URL=http://localhost:7071/api
EOF

echo ""
echo "=========================================="
echo "Local setup complete!"
echo "=========================================="
echo "Files created:"
echo "  - local.settings.json (Azure Functions)"
echo "  - .env.local (Frontend)"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Install dependencies: npm install"
echo "  2. Start Azure Functions: npm run start:functions"
echo "  3. Start frontend: npm run start:web"
