targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Unique suffix for resource names')
param uniqueSuffix string = uniqueString(resourceGroup().id)

@description('Tags to apply to all resources')
param tags object = {
  project: 'photo-archive'
  environment: environment
  managedBy: 'bicep'
}

var resourcePrefix = 'photoarch${environment}${uniqueSuffix}'

// Storage Account Module
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    storageAccountName: take('${resourcePrefix}st', 24) // Max 24 chars
    location: location
    environment: environment
    tags: tags
  }
}

// Outputs
output storageAccountName string = storage.outputs.storageAccountName
output storageAccountId string = storage.outputs.storageAccountId
output primaryEndpoints object = storage.outputs.primaryEndpoints
output webEndpoint string = storage.outputs.webEndpoint
output resourceGroupName string = resourceGroup().name
