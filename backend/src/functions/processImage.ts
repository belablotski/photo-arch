import { app, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { createHash } from 'crypto';
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
 * - Copy original to photos container with content-hash name
 * - Copy thumbnail to thumbnails container
 * - Delete from landing-zone after success
 * - Skip duplicates (deduplication via content hash)
 * 
 * Blob Trigger: landing-zone/{name}
 */
app.storageBlob('process-image', {
  path: 'landing-zone/{name}',
  connection: 'StorageConnectionString',
  handler: async (blob: unknown, context: InvocationContext): Promise<void> => {
    const blobBuffer = blob as Buffer;
    const blobName = (context.triggerMetadata?.name as string) || 'unknown';
    const blobPath = (context.triggerMetadata?.uri as string) || 'unknown';
    
    context.log(`Processing image: ${blobName} (from ${blobPath})`);

    // Store original filename for metadata
    const originalFilename = blobName;
    
    // Calculate SHA-256 hash of file content for deduplication
    const fileHash = createHash('sha256').update(blobBuffer).digest('hex');
    const hashPrefix = fileHash.substring(0, 8);
    
    // Generate permanent blob name: {originalName}_{hash}.{ext}
    const lastDotIndex = originalFilename.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? originalFilename.substring(0, lastDotIndex) : originalFilename;
    const extension = lastDotIndex > 0 ? originalFilename.substring(lastDotIndex) : '';
    const permanentBlobName = `${nameWithoutExt}_${hashPrefix}${extension}`;
    
    context.log(`Generated content-based name: ${permanentBlobName} (hash: ${hashPrefix}) for original: ${originalFilename}`);

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
      const imageMetadata = await getImageMetadata(blobBuffer);
      context.log(`Image metadata: ${JSON.stringify(imageMetadata)}`);

      // Generate thumbnail
      context.log(`Generating thumbnail (${thumbnailWidth}px width)...`);
      const thumbnailBuffer = await generateThumbnail(blobBuffer, thumbnailWidth);

      // Get blob clients
      const photosContainerClient = blobServiceClient.getContainerClient(photosContainer);
      const thumbnailsContainerClient = blobServiceClient.getContainerClient(thumbnailsContainer);
      const landingContainerClient = blobServiceClient.getContainerClient(landingContainer);

      // Check if photo already exists (deduplication)
      const photoBlobClient = photosContainerClient.getBlockBlobClient(permanentBlobName);
      const photoExists = await photoBlobClient.exists();
      
      if (photoExists) {
        context.log(`⚠️ Photo already exists: ${permanentBlobName} - skipping upload (duplicate detected)`);
        context.log(`Duplicate of original: ${originalFilename}`);
        
        // Still delete from landing zone
        context.log(`Deleting duplicate from ${landingContainer}/${blobName}...`);
        const landingBlobClient = landingContainerClient.getBlockBlobClient(blobName);
        await landingBlobClient.delete();
        
        context.log(`✅ Duplicate removed from landing zone`);
        return; // Exit - don't process duplicate
      }

      // Upload original to photos container with content-hash name
      context.log(`Copying original to ${photosContainer}/${permanentBlobName}...`);
      await photoBlobClient.uploadData(blobBuffer, {
        metadata: {
          originalFilename: originalFilename,  // Store original camera filename
          uploadDate: new Date().toISOString(),
          width: imageMetadata.width.toString(),
          height: imageMetadata.height.toString(),
          format: imageMetadata.format
        },
      });

      // Set default blob tags (flat structure with author in tags)
      // TODO: Extract from EXIF when implemented
      await photoBlobClient.setTags({
        author: "default-user", // TODO: Get from authentication
        dateTaken: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        camera: "",
        lens: "",
        location: "",
        rating: "0",
        customTag1: "",
        customTag2: "",
        customTag3: "",
        favorite: "false"
      });

      // Upload thumbnail to thumbnails container with same content-hash name
      context.log(`Copying thumbnail to ${thumbnailsContainer}/${permanentBlobName}...`);
      const thumbnailBlobClient = thumbnailsContainerClient.getBlockBlobClient(permanentBlobName);
      await thumbnailBlobClient.uploadData(thumbnailBuffer, {
        metadata: {
          originalFilename: originalFilename  // Store original camera filename
        },
      });

      // Delete from landing-zone after successful processing
      context.log(`Deleting from ${landingContainer}/${blobName}...`);
      const landingBlobClient = landingContainerClient.getBlockBlobClient(blobName);
      await landingBlobClient.delete();

      context.log(`✅ Successfully processed image: ${blobName} → ${permanentBlobName}`);

    } catch (error) {
      context.log(`ERROR: Failed to process image ${blobName}:`, error);
      // Don't delete from landing-zone on error - leave it for retry
      throw error;
    }
  }
});

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
