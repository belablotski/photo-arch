import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
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
 * Returns: { uploadUrl: string, blobName: string, expiresAt: string }
 */
export async function generateUploadToken(
  context: InvocationContext,
  request: HttpRequest
): Promise<HttpResponseInit> {
  context.log('Processing request to generate upload SAS token');

  try {
    // Parse request body
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

    // Sanitize filename (prevent directory traversal)
    const sanitizedFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Generate unique blob name with timestamp
    const timestamp = Date.now();
    const blobName = `${timestamp}-${sanitizedFilename}`;

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
      context.log('ERROR: Invalid connection string format');
      return {
        status: 500,
        jsonBody: {
          error: 'Server configuration error',
          message: 'Invalid storage configuration',
        },
      };
    }

    // Create credentials
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

    // Set expiry time
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

    // Define SAS permissions (write only)
    const permissions = BlobSASPermissions.parse('w'); // Write permission only

    // Generate SAS token
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions,
        expiresOn,
      },
      sharedKeyCredential
    ).toString();

    // Construct upload URL
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
    context.log('ERROR: Error generating SAS token:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    };
  }
}

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
