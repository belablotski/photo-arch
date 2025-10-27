@description('Storage account name')
param storageAccountName string

@description('Location for the storage account')
param location string

@description('Environment name')
param environment string

@description('Tags to apply to the storage account')
param tags object

@description('Storage account SKU')
@allowed(['Standard_LRS', 'Standard_GRS', 'Standard_ZRS'])
param storageSku string = 'Standard_LRS'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: storageSku
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowSharedKeyAccess: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

// Container: Landing Zone (temporary uploads)
resource landingZoneContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'landing-zone'
  properties: {
    publicAccess: 'None'
    metadata: {
      description: 'Temporary storage for uploaded images before processing'
    }
  }
}

// Container: Photos (permanent archive)
resource photosContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'photos'
  properties: {
    publicAccess: 'None'
    metadata: {
      description: 'Permanent storage for original photos with lifecycle management'
    }
  }
}

// Container: Thumbnails (generated previews)
resource thumbnailsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'thumbnails'
  properties: {
    publicAccess: 'None'
    metadata: {
      description: 'Generated thumbnail images for fast browsing'
    }
  }
}

// Lifecycle Management Policy
resource managementPolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          enabled: true
          name: 'move-photos-to-cool'
          type: 'Lifecycle'
          definition: {
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 30
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 90
                }
              }
            }
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['photos/']
            }
          }
        }
        // NOTE: Landing zone cleanup is handled by Azure Function after successful processing
        // This prevents data loss if function fails before copying to photos container
        // The deleteRetentionPolicy (7 days) provides emergency recovery if needed
      ]
    }
  }
}

// Outputs
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output primaryEndpoints object = storageAccount.properties.primaryEndpoints
output webEndpoint string = storageAccount.properties.primaryEndpoints.web
