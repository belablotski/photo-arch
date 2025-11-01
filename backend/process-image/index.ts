import { InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import sharp from 'sharp';

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

/**
 * Process uploaded images from landing-zone container
 * - Generate thumbnail
 * - Copy original to photos container
 * - Copy thumbnail to thumbnails container
 * - Delete from landing-zone after success
 * 
 * Blob Trigger: landing-zone/{name}
 * Note: For v3 model, bindingData contains the blob path
 */
export async function processImage(
  context: InvocationContext,
  blob: Buffer
): Promise<void> {
  // Access bindingData which exists at runtime but not in TypeScript types
  const bindingData = (context as any).bindingData;
  
  // The blobTrigger contains the full path: "landing-zone/filename.jpg"
  const blobTrigger = bindingData?.blobTrigger as string;
  
  if (!blobTrigger) {
    context.log('ERROR: No blobTrigger found in bindingData:', JSON.stringify(bindingData));
    throw new Error('Blob trigger path not found');
  }
  
  // Extract just the filename from the path
  const blobName = blobTrigger.split('/').pop() || blobTrigger;
  context.log(`Processing image: ${blobName} (from ${blobTrigger})`);

  try {
    // Get configuration
    const connectionString = process.env.StorageConnectionString;
    const photosContainer = process.env.PHOTOS_CONTAINER;
    const thumbnailsContainer = process.env.THUMBNAILS_CONTAINER;
    const landingContainer = process.env.LANDING_ZONE_CONTAINER;
    const thumbnailWidth = process.env.THUMBNAIL_WIDTH ? parseInt(process.env.THUMBNAIL_WIDTH, 10) : undefined;

    // Validate all required configuration
    if (!connectionString) {
      throw new Error('StorageConnectionString not configured');
    }
    if (!photosContainer) {
      throw new Error('PHOTOS_CONTAINER not configured');
    }
    if (!thumbnailsContainer) {
      throw new Error('THUMBNAILS_CONTAINER not configured');
    }
    if (!landingContainer) {
      throw new Error('LANDING_ZONE_CONTAINER not configured');
    }
    if (!thumbnailWidth) {
      throw new Error('THUMBNAIL_WIDTH not configured');
    }

    context.log(`Configuration loaded: photos=${photosContainer}, thumbnails=${thumbnailsContainer}, thumbnailWidth=${thumbnailWidth}px`);

    // Create blob service client
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    // Get image metadata
    const imageMetadata = await getImageMetadata(blob);
    context.log(`Image metadata: ${JSON.stringify(imageMetadata)}`);

    // Generate thumbnail
    context.log(`Generating thumbnail (${thumbnailWidth}px width)...`);
    const thumbnailBuffer = await generateThumbnail(blob, thumbnailWidth);

    // Get blob clients
    const photosContainerClient = blobServiceClient.getContainerClient(photosContainer);
    const thumbnailsContainerClient = blobServiceClient.getContainerClient(thumbnailsContainer);
    const landingContainerClient = blobServiceClient.getContainerClient(landingContainer);

    // Upload original to photos container
    context.log(`Copying original to ${photosContainer}/${blobName}...`);
    const photoBlobClient = photosContainerClient.getBlockBlobClient(blobName);
    await photoBlobClient.uploadData(blob, {
      metadata: {
        originalName: blobName,
        uploadDate: new Date().toISOString(),
        width: imageMetadata.width.toString(),
        height: imageMetadata.height.toString(),
        format: imageMetadata.format
      },
    });

    // Upload thumbnail to thumbnails container
    context.log(`Copying thumbnail to ${thumbnailsContainer}/${blobName}...`);
    const thumbnailBlobClient = thumbnailsContainerClient.getBlockBlobClient(blobName);
    await thumbnailBlobClient.uploadData(thumbnailBuffer, {
      metadata: {
        originalName: blobName
      },
    });

    // Delete from landing-zone after successful processing
    context.log(`Deleting from ${landingContainer}/${blobName}...`);
    const landingBlobClient = landingContainerClient.getBlockBlobClient(blobName);
    await landingBlobClient.delete();

    context.log(`Successfully processed image: ${blobName}`);

  } catch (error) {
    context.log(`ERROR: Failed to process image ${blobName}:`, error);
    // Don't delete from landing-zone on error - leave it for retry
    throw error;
  }
}

/**
 * Get image metadata using sharp
 */
async function getImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: imageBuffer.length,
  };
}

/**
 * Generate thumbnail using sharp
 * Maintains aspect ratio
 */
async function generateThumbnail(imageBuffer: Buffer, width: number): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(width, null, {
      withoutEnlargement: true, // Don't upscale small images
      fit: 'inside', // Maintain aspect ratio
    })
    .jpeg({ quality: 85, progressive: true }) // Convert to optimized JPEG
    .toBuffer();
}
