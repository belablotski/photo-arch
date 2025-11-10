import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';

interface UploadTokenRequest {
  filename: string;
  contentType?: string;
}

interface UploadTokenResponse {
  uploadUrl: string;
  blobName: string;
  containerName: string;
  expiresAt: string;
}

/**
 * Generates a SAS token for uploading a photo to the landing-zone container
 * 
 * POST /api/generate-upload-token
 * Body: { filename: string, contentType?: string }
 * 
 * Landing zone uses original filename for simplicity.
 * Process-image will add content hash postfix for permanent storage.
 * 
 * Returns: { uploadUrl: string, blobName: string, expiresAt: string }
 */
app.http('generate-sas-token', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'generate-upload-token',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('Processing request to generate upload SAS token');

    try {
      // Parse request body (v4 model)
      const body = await request.json() as UploadTokenRequest;
      
      // Validate input
      if (!body.filename || typeof body.filename !== 'string') {
        return {
          status: 400,
          jsonBody: {
            error: 'Missing or invalid filename',
            message: 'Request body must include a valid filename string',
          },
        };
      }

      // Sanitize filename (remove path separators to prevent directory traversal)
      // Keep the original filename structure otherwise - process-image will handle uniqueness
      const sanitizedFilename = body.filename.replace(/[/\\]/g, '_');
      const blobName = sanitizedFilename;

      context.log(`Using blob name: ${blobName} for upload`);

      // Get configuration from environment
      const connectionString = process.env.StorageConnectionString;
      const containerName = process.env.LANDING_ZONE_CONTAINER || 'landing-zone';
      const expiryMinutes = parseInt(process.env.SAS_TOKEN_EXPIRY_MINUTES || '5', 10);

      if (!connectionString) {
        context.log('ERROR: StorageConnectionString not configured');
        return {
          status: 500,
          jsonBody: {
            error: 'Server configuration error',
            message: 'Storage connection not configured',
          },
        };
      }

      // Parse connection string to get account name and key
      const accountName = extractAccountName(connectionString);
      const accountKey = extractAccountKey(connectionString);

      if (!accountName || !accountKey) {
        context.log('ERROR: Failed to parse storage account credentials');
        return {
          status: 500,
          jsonBody: {
            error: 'Server configuration error',
            message: 'Invalid storage credentials',
          },
        };
      }

      // Create shared key credential
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

      // Generate SAS token with write permissions
      const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse('w'), // Write permission only
          startsOn: new Date(),
          expiresOn,
        },
        sharedKeyCredential
      ).toString();

      // Construct the full upload URL
      const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;

      const response: UploadTokenResponse = {
        uploadUrl,
        blobName,
        containerName,
        expiresAt: expiresOn.toISOString(),
      };

      context.log(`Generated SAS token for blob: ${blobName}, expires: ${expiresOn.toISOString()}`);
      return {
        status: 200,
        jsonBody: response,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.log(`ERROR: Error generating SAS token: ${errorMessage}`);
      return {
        status: 500,
        jsonBody: {
          error: 'Failed to generate upload token',
          message: errorMessage,
        },
      };
    }
  }
});

/**
 * Extract account name from connection string
 */
function extractAccountName(connectionString: string): string | null {
  const match = connectionString.match(/AccountName=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Extract account key from connection string
 */
function extractAccountKey(connectionString: string): string | null {
  const match = connectionString.match(/AccountKey=([^;]+)/);
  return match ? match[1] : null;
}
