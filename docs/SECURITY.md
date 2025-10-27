# Security Guide: Connection String Management

## Local Development

### Setup (One-time)

1. Copy the template:
   ```bash
   cd backend
   cp local.settings.json.template local.settings.json
   ```

2. Get your connection string:
   ```bash
   # From project root
   STORAGE_ACCOUNT=$(jq -r '.storageAccountName' .azure/dev-outputs.json)
   RESOURCE_GROUP=$(jq -r '.resourceGroup' .azure/dev-outputs.json)
   
   az storage account show-connection-string \
     --name $STORAGE_ACCOUNT \
     --resource-group $RESOURCE_GROUP \
     --output tsv
   ```

3. Paste the connection string into `local.settings.json`:
   ```json
   {
     "Values": {
       "StorageConnectionString": "DefaultEndpointsProtocol=https;AccountName=..."
     }
   }
   ```

### Security for Local Dev

✅ **Protected:**
- `local.settings.json` is gitignored
- Won't be committed to repository

⚠️ **Risks:**
- Plain text on your machine
- Full access to storage account
- Could be leaked if machine is compromised

**Best Practices:**
- Don't share `local.settings.json`
- Don't copy/paste connection strings in chat/email
- Use dev/test data only
- Rotate keys periodically

## Production Deployment

### Option 1: Managed Identity (Recommended)

**Setup:**

1. Enable Managed Identity on Function App:
   ```bash
   az functionapp identity assign \
     --name <function-app-name> \
     --resource-group <resource-group>
   ```

2. Grant storage permissions:
   ```bash
   FUNCTION_PRINCIPAL_ID=$(az functionapp identity show \
     --name <function-app-name> \
     --resource-group <resource-group> \
     --query principalId \
     --output tsv)
   
   STORAGE_ACCOUNT_ID=$(az storage account show \
     --name <storage-account> \
     --resource-group <resource-group> \
     --query id \
     --output tsv)
   
   # Grant "Storage Blob Data Contributor" role
   az role assignment create \
     --assignee $FUNCTION_PRINCIPAL_ID \
     --role "Storage Blob Data Contributor" \
     --scope $STORAGE_ACCOUNT_ID
   ```

3. Update function code to use Managed Identity:
   ```typescript
   import { DefaultAzureCredential } from '@azure/identity';
   
   // Instead of connection string:
   const credential = new DefaultAzureCredential();
   const blobServiceClient = new BlobServiceClient(
     `https://${accountName}.blob.core.windows.net`,
     credential
   );
   ```

4. Update Function App settings:
   ```bash
   az functionapp config appsettings set \
     --name <function-app-name> \
     --resource-group <resource-group> \
     --settings \
       "STORAGE_ACCOUNT_NAME=<storage-account>" \
       "USE_MANAGED_IDENTITY=true"
   ```

**Benefits:**
- 🏆 No secrets to manage
- 🏆 Automatic credential rotation
- 🏆 Cannot be leaked
- 🏆 Audit trail in Azure AD

### Option 2: Azure Key Vault

**Setup:**

1. Create Key Vault:
   ```bash
   az keyvault create \
     --name <vault-name> \
     --resource-group <resource-group> \
     --location westus2
   ```

2. Store connection string:
   ```bash
   CONNECTION_STRING=$(az storage account show-connection-string \
     --name <storage-account> \
     --resource-group <resource-group> \
     --output tsv)
   
   az keyvault secret set \
     --vault-name <vault-name> \
     --name StorageConnectionString \
     --value "$CONNECTION_STRING"
   ```

3. Grant Function App access to Key Vault:
   ```bash
   az functionapp identity assign \
     --name <function-app-name> \
     --resource-group <resource-group>
   
   FUNCTION_PRINCIPAL_ID=$(az functionapp identity show \
     --name <function-app-name> \
     --resource-group <resource-group> \
     --query principalId \
     --output tsv)
   
   az keyvault set-policy \
     --name <vault-name> \
     --object-id $FUNCTION_PRINCIPAL_ID \
     --secret-permissions get list
   ```

4. Reference in Function App settings:
   ```bash
   SECRET_URI=$(az keyvault secret show \
     --vault-name <vault-name> \
     --name StorageConnectionString \
     --query id \
     --output tsv)
   
   az functionapp config appsettings set \
     --name <function-app-name> \
     --resource-group <resource-group> \
     --settings "StorageConnectionString=@Microsoft.KeyVault(SecretUri=${SECRET_URI})"
   ```

**Benefits:**
- ✅ Centralized secret management
- ✅ Access auditing
- ✅ Automatic rotation support
- ⚠️ Still uses connection string (not as secure as Managed Identity)

## Security Best Practices

### DO ✅
- Use Managed Identity in production
- Rotate keys regularly (every 90 days)
- Use separate storage accounts for dev/staging/prod
- Enable Azure Monitor for access logging
- Use least-privilege permissions (RBAC)
- Keep `local.settings.json` gitignored

### DON'T ❌
- Commit connection strings to git
- Share connection strings in chat/email
- Use production keys in development
- Hard-code connection strings
- Use same storage account for all environments
- Give developers production access keys

## Key Rotation

### Automatic (Managed Identity)
No rotation needed - Azure handles it!

### Manual (Connection String)

1. Regenerate key in Azure:
   ```bash
   az storage account keys renew \
     --account-name <storage-account> \
     --key primary
   ```

2. Update Key Vault secret (if using):
   ```bash
   az keyvault secret set \
     --vault-name <vault-name> \
     --name StorageConnectionString \
     --value "<new-connection-string>"
   ```

3. Restart Function App:
   ```bash
   az functionapp restart \
     --name <function-app-name> \
     --resource-group <resource-group>
   ```

## Troubleshooting

### "StorageConnectionString not configured"
- Check `local.settings.json` exists
- Verify connection string format
- Ensure no extra spaces/newlines

### "Authentication failed" with Managed Identity
- Verify Managed Identity is enabled
- Check RBAC role assignments
- Ensure correct storage account name

### Key Vault access denied
- Verify Function App has Managed Identity
- Check Key Vault access policies
- Ensure secret URI is correct

## Next Steps

- [ ] TODO: Implement Managed Identity support in code
- [ ] TODO: Add Key Vault to infrastructure Bicep templates
- [ ] TODO: Create production deployment guide
- [ ] TODO: Set up key rotation automation
