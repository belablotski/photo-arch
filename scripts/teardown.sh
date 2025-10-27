#!/bin/bash
set -e

# Photo Archive - Teardown Script
# WARNING: This will delete all resources in the resource group

ENVIRONMENT=${1:-dev}
RESOURCE_GROUP="photo-archive-${ENVIRONMENT}-rg"

echo "=========================================="
echo "WARNING: Resource Group Deletion"
echo "=========================================="
echo "This will delete the entire resource group:"
echo "  $RESOURCE_GROUP"
echo ""
echo "All resources and data will be permanently lost!"
echo "=========================================="
read -p "Type the environment name to confirm: " CONFIRMATION

if [ "$CONFIRMATION" != "$ENVIRONMENT" ]; then
    echo "Confirmation failed. Teardown cancelled."
    exit 1
fi

echo "Deleting resource group: $RESOURCE_GROUP"
az group delete \
  --name $RESOURCE_GROUP \
  --yes \
  --no-wait

echo "Deletion initiated. This may take several minutes."
echo "Monitor status with: az group show --name $RESOURCE_GROUP"
