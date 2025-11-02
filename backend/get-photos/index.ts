import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from "@azure/storage-blob";

/**
 * Retrieves photos from storage with filtering and pagination
 * 
 * GET /api/photos?author=john.doe&limit=20&dateTaken>=2025-01-01&rating>=4
 * 
 * Returns: { photos: Photo[], continuationToken: string, hasMore: boolean }
 */
export async function getPhotos(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.info("GET /api/photos - Photo retrieval request received");

  try {
    const connectionString = process.env.StorageConnectionString;
    if (!connectionString) {
      throw new Error("StorageConnectionString not configured");
    }

    // Parse query parameters
    const limit = parseInt(req.query.get('limit') || "20");
    const continuationToken = req.query.get('continuationToken') || undefined;
    const author = req.query.get('author') || "default-user"; // TODO: Get from authentication

    // Filter parameters
    const dateTaken = req.query.get('dateTaken') || undefined;
    const camera = req.query.get('camera') || undefined;
    const lens = req.query.get('lens') || undefined;
    const location = req.query.get('location') || undefined;
    const hasGPS = req.query.get('hasGPS') || undefined;
    const rating = req.query.get('rating') || undefined;
    const customTag1 = req.query.get('customTag1') || undefined;
    const customTag2 = req.query.get('customTag2') || undefined;
    const customTag3 = req.query.get('customTag3') || undefined;
    const favorite = req.query.get('favorite') || undefined;

    context.info(`Retrieving photos for user: ${author}, limit: ${limit}`);
    if (continuationToken) {
      context.info(`Continuation token provided`);
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient("photos");

    const photos = [];
    let nextContinuationToken = null;

    // List blobs with user prefix
    const iterator = containerClient.listBlobsFlat({
      prefix: `${author}/`,
      includeMetadata: true,
      includeTags: true
    }).byPage({ maxPageSize: limit, continuationToken });

    // Get first page only
    const page = (await iterator.next()).value;
    
    if (page) {
      context.info(`Found ${page.segment.blobItems.length} blobs in page`);

      for (const blob of page.segment.blobItems) {
        // Apply tag filtering if provided
        if (!matchesFilters(blob.tags, {
          dateTaken,
          camera,
          lens,
          location,
          hasGPS,
          rating,
          customTag1,
          customTag2,
          customTag3,
          favorite
        })) {
          continue;
        }

        // Extract filename from path (remove author prefix)
        const filename = blob.name.split('/').pop() || blob.name;

        // Generate SAS URLs for thumbnail and photo (1 hour expiration)
        const thumbnailUrl = await generateReadSasUrl(
          connectionString,
          "thumbnails",
          `${author}/${filename}`,
          60 // 1 hour
        );
        const photoUrl = await generateReadSasUrl(
          connectionString,
          "photos",
          blob.name,
          60
        );

        photos.push({
          id: filename,
          originalFilename: blob.metadata?.originalFilename || filename,
          thumbnailUrl,
          photoUrl,
          uploadDate: blob.properties.createdOn?.toISOString(),
          size: blob.properties.contentLength,
          dimensions: {
            width: parseInt(blob.metadata?.width || "0"),
            height: parseInt(blob.metadata?.height || "0")
          },
          format: blob.metadata?.format || "jpeg",
          tags: blob.tags || {}
        });
      }

      nextContinuationToken = page.continuationToken;
      context.info(`Returning ${photos.length} photos, hasMore: ${!!nextContinuationToken}`);
    }

    return {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // TODO: Configure proper CORS
      },
      jsonBody: {
        photos,
        continuationToken: nextContinuationToken,
        hasMore: !!nextContinuationToken,
        totalReturned: photos.length
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error(`Error retrieving photos: ${errorMessage}`);
    return {
      status: 500,
      headers: { "Content-Type": "application/json" },
      jsonBody: {
        error: "Failed to retrieve photos",
        message: errorMessage
      }
    };
  }
}

/**
 * Check if blob tags match the provided filters
 */
function matchesFilters(tags: Record<string, string> | undefined, filters: Record<string, string | undefined>): boolean {
  if (!tags) return true; // No tags means no filtering

  for (const [key, filterValue] of Object.entries(filters)) {
    if (!filterValue) continue; // Skip empty filters

    const tagValue = tags[key];
    if (!tagValue) return false; // Tag doesn't exist

    // Handle comparison operators for dateTaken and rating
    if (key === 'dateTaken' || key === 'rating') {
      const match = filterValue.match(/^(>=|<=|>|<|=)?(.+)$/);
      if (match) {
        const operator = match[1] || '=';
        const value = match[2];

        if (!compareValues(tagValue, operator, value)) {
          return false;
        }
      }
    } else {
      // Exact match for other tags
      if (tagValue !== filterValue) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Compare values with operator
 */
function compareValues(tagValue: string, operator: string, filterValue: string): boolean {
  switch (operator) {
    case '>=':
      return tagValue >= filterValue;
    case '<=':
      return tagValue <= filterValue;
    case '>':
      return tagValue > filterValue;
    case '<':
      return tagValue < filterValue;
    case '=':
    default:
      return tagValue === filterValue;
  }
}

/**
 * Generate a read-only SAS URL for a blob
 */
async function generateReadSasUrl(
  connectionString: string,
  containerName: string,
  blobName: string,
  expirationMinutes: number
): Promise<string> {
  // Parse connection string to get account name and key
  const accountMatch = connectionString.match(/AccountName=([^;]+)/);
  const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
  
  if (!accountMatch || !keyMatch) {
    throw new Error("Invalid connection string format");
  }

  const accountName = accountMatch[1];
  const accountKey = keyMatch[1];

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"), // Read-only
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + expirationMinutes * 60 * 1000)
    },
    sharedKeyCredential
  ).toString();

  return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
}
