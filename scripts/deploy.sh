#!/bin/bash
set -e

# Photo Archive - Infrastructure Deployment Script
# Usage: ./scripts/deploy.sh [dev|staging|prod]

ENVIRONMENT=${1:-dev}
RESOURCE_GROUP="photo-archive-${ENVIRONMENT}-rg"
LOCATION="westus2"
DEPLOYMENT_NAME="photo-archive-$(date +%Y%m%d-%H%M%S)"

echo "=========================================="
echo "Photo Archive Infrastructure Deployment"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "=========================================="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI is not installed. Please install it first."
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
echo "Checking Azure login status..."
az account show &> /dev/null || {
    echo "Not logged in. Please login to Azure..."
    az login
}

# Display current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo "Using subscription: $SUBSCRIPTION"
read -p "Continue with this subscription? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Create resource group
echo "Creating resource group: $RESOURCE_GROUP"
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags project=photo-archive environment=$ENVIRONMENT

# Validate Bicep template
echo "Validating Bicep template..."
az deployment group validate \
  --resource-group $RESOURCE_GROUP \
  --template-file infrastructure/main.bicep \
  --parameters "infrastructure/parameters/${ENVIRONMENT}.bicepparam"

if [ $? -ne 0 ]; then
    echo "Template validation failed. Please fix errors and try again."
    exit 1
fi

# Preview changes (what-if)
echo "Previewing deployment changes..."
az deployment group what-if \
  --resource-group $RESOURCE_GROUP \
  --template-file infrastructure/main.bicep \
  --parameters "infrastructure/parameters/${ENVIRONMENT}.bicepparam"

read -p "Proceed with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Deploy infrastructure
echo "Deploying infrastructure..."
az deployment group create \
  --name $DEPLOYMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --template-file infrastructure/main.bicep \
  --parameters "infrastructure/parameters/${ENVIRONMENT}.bicepparam"

# Get deployment outputs
echo "Retrieving deployment outputs..."
STORAGE_ACCOUNT=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name $DEPLOYMENT_NAME \
  --query properties.outputs.storageAccountName.value \
  --output tsv)

WEB_ENDPOINT=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name $DEPLOYMENT_NAME \
  --query properties.outputs.webEndpoint.value \
  --output tsv)

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Web Endpoint: $WEB_ENDPOINT"
echo "Resource Group: $RESOURCE_GROUP"
echo "=========================================="

# Save outputs to file
mkdir -p .azure
cat > ".azure/${ENVIRONMENT}-outputs.json" <<EOF
{
  "storageAccountName": "$STORAGE_ACCOUNT",
  "webEndpoint": "$WEB_ENDPOINT",
  "resourceGroup": "$RESOURCE_GROUP",
  "deploymentName": "$DEPLOYMENT_NAME",
  "deploymentDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo "Outputs saved to: .azure/${ENVIRONMENT}-outputs.json"
