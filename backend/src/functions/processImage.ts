import { app, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { createHash } from 'crypto';
import sharp from 'sharp';
import exifr from 'exifr';
import { exiftool } from 'exiftool-vendored';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

interface ExifData {
  make?: string;
  model?: string;
  lensModel?: string;
  lensMake?: string;
  dateTimeOriginal?: Date;
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
  focalLength?: number;
  latitude?: number;
  longitude?: number;
  artist?: string;
  copyright?: string;
  orientation?: number;
  // Image dimensions (from RAW files)
  imageWidth?: number;
  imageHeight?: number;
}

interface BlobTags {
  author: string;
  dateTaken: string;
  camera: string;
  lens: string;
  location: string;
  rating: string;
  customTag1: string;
  customTag2: string;
  customTag3: string;
  favorite: string;
  [key: string]: string; // Index signature for Azure SDK compatibility
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

      // Extract EXIF data
      context.log(`Extracting EXIF data...`);
      const exifData = await extractExifData(blobBuffer, originalFilename);
      if (exifData) {
        context.log(`EXIF extracted: camera=${exifData.make} ${exifData.model}, lens=${exifData.lensModel}, date=${exifData.dateTimeOriginal}`);
      } else {
        context.log(`No EXIF data found in image`);
      }

      // Generate thumbnail first (for RAW files, this extracts embedded JPEG)
      context.log(`Generating thumbnail (${thumbnailWidth}px width)...`);
      const thumbnailBuffer = await generateThumbnail(blobBuffer, thumbnailWidth, originalFilename, context);

      // Get image metadata (use thumbnail for RAW files since Sharp can't read RAW directly)
      const isRawFile = /\.(cr2|cr3|nef|arw|raf|orf|rw2|dng|pef)$/i.test(originalFilename);
      const imageMetadata = isRawFile 
        ? await getImageMetadata(thumbnailBuffer) 
        : await getImageMetadata(blobBuffer);
      context.log(`Image metadata: ${JSON.stringify(imageMetadata)}`);

      // Get blob clients
      const photosContainerClient = blobServiceClient.getContainerClient(photosContainer);
      const thumbnailsContainerClient = blobServiceClient.getContainerClient(thumbnailsContainer);
      const landingContainerClient = blobServiceClient.getContainerClient(landingContainer);

      // Read metadata from landing-zone blob (uploaded by frontend)
      const tempLandingBlobClient = landingContainerClient.getBlockBlobClient(blobName);
      const blobProperties = await tempLandingBlobClient.getProperties();
      const uploadedMetadata = blobProperties.metadata || {};
      context.log(`Uploaded metadata: ${JSON.stringify(uploadedMetadata)}`);
      
      // Read custom tags from separate fields (matches blob index tag structure)
      const customTagsFromUpload = [
        uploadedMetadata.customTag1,
        uploadedMetadata.customTag2,
        uploadedMetadata.customTag3
      ].filter(Boolean); // Remove undefined/empty values

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
      
      // For RAW files, use dimensions from EXIF; for JPEG, use Sharp metadata
      const actualWidth = (isRawFile && exifData?.imageWidth) ? exifData.imageWidth : imageMetadata.width;
      const actualHeight = (isRawFile && exifData?.imageHeight) ? exifData.imageHeight : imageMetadata.height;
      
      await photoBlobClient.uploadData(blobBuffer, {
        metadata: {
          originalFilename: originalFilename,  // Store original camera filename
          uploadDate: new Date().toISOString(),
          width: actualWidth.toString(),
          height: actualHeight.toString(),
          format: imageMetadata.format,
          // Add EXIF metadata
          ...(exifData?.iso && { iso: exifData.iso.toString() }),
          ...(exifData?.fNumber && { aperture: `f/${exifData.fNumber}` }),
          ...(exifData?.exposureTime && { shutterSpeed: `1/${Math.round(1 / exifData.exposureTime)}` }),
          ...(exifData?.focalLength && { focalLength: `${exifData.focalLength}mm` }),
          ...(exifData?.artist && { artist: exifData.artist }),
          ...(exifData?.copyright && { copyright: exifData.copyright })
        },
      });

      // Create blob tags from EXIF data and uploaded metadata
      const blobTags: Record<string, string> = createBlobTags(
        exifData, 
        uploadedMetadata.author || "default-user", // Use uploaded author or default
        uploadedMetadata.location, // Use uploaded location
        customTagsFromUpload // Use uploaded custom tags
      );
      context.log(`Setting blob tags: ${JSON.stringify(blobTags)}`);
      await photoBlobClient.setTags(blobTags);

      // Upload thumbnail to thumbnails container with .jpg extension (thumbnails are always JPEG)
      const thumbnailBlobName = `${nameWithoutExt}_${hashPrefix}.jpg`;
      context.log(`Copying thumbnail to ${thumbnailsContainer}/${thumbnailBlobName}...`);
      const thumbnailBlobClient = thumbnailsContainerClient.getBlockBlobClient(thumbnailBlobName);
      
      // Get thumbnail dimensions for metadata
      const thumbnailMetadata = await getImageMetadata(thumbnailBuffer);
      
      await thumbnailBlobClient.uploadData(thumbnailBuffer, {
        metadata: {
          originalFilename: originalFilename,  // Store original camera filename
          uploadDate: new Date().toISOString(),
          width: thumbnailMetadata.width.toString(),
          height: thumbnailMetadata.height.toString(),
          format: thumbnailMetadata.format,
          // Add EXIF metadata (same as main photo)
          ...(exifData?.iso && { iso: exifData.iso.toString() }),
          ...(exifData?.fNumber && { aperture: `f/${exifData.fNumber}` }),
          ...(exifData?.exposureTime && { shutterSpeed: `1/${Math.round(1 / exifData.exposureTime)}` }),
          ...(exifData?.focalLength && { focalLength: `${exifData.focalLength}mm` }),
          ...(exifData?.artist && { artist: exifData.artist }),
          ...(exifData?.copyright && { copyright: exifData.copyright }),
          // Link to original photo for reference
          originalPhotoWidth: actualWidth.toString(),
          originalPhotoHeight: actualHeight.toString()
        },
      });

      // Apply same blob tags to thumbnail for UI filtering
      context.log(`Setting blob tags on thumbnail: ${JSON.stringify(blobTags)}`);
      await thumbnailBlobClient.setTags(blobTags);

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
 * For RAW files, extracts embedded JPEG preview using exiftool
 */
async function generateThumbnail(imageBuffer: Buffer, width: number, filename?: string, context?: InvocationContext): Promise<Buffer> {
  let sourceBuffer = imageBuffer;
  
  // Check if this is a RAW file by extension
  const isRawFile = filename && /\.(cr2|cr3|nef|arw|raf|orf|rw2|dng|pef)$/i.test(filename);
  
  if (isRawFile) {
    // For RAW files, use exiftool to extract embedded preview
    let tempFilePath: string | null = null;
    try {
      if (context) {
        context.log(`Extracting embedded preview from RAW file using exiftool: ${filename}`);
      }
      
      // Write buffer to temp file (exiftool needs file path)
      const tempFileName = `raw_${Date.now()}_${filename}`;
      tempFilePath = join(tmpdir(), tempFileName);
      await writeFile(tempFilePath, imageBuffer);
      
      // Extract preview using exiftool (requires output file path)
      const previewPath = join(tmpdir(), `preview_${Date.now()}.jpg`);
      await exiftool.extractPreview(tempFilePath, previewPath);
      
      // Read the preview file
      const fs = await import('fs/promises');
      sourceBuffer = await fs.readFile(previewPath);
      
      // Clean up preview file
      try {
        await fs.unlink(previewPath);
      } catch {}
      
      if (context) {
        context.log(`✅ Extracted embedded JPEG preview (${sourceBuffer.length} bytes) from RAW file: ${filename}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (context) {
        context.log(`ERROR: Failed to extract RAW preview for ${filename}: ${errorMessage}`);
      }
      throw new Error(`Cannot generate thumbnail for RAW file ${filename}: ${errorMessage}`);
    } finally {
      // Clean up temp file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
        } catch (cleanupError) {
          if (context) {
            context.log(`Warning: Failed to delete temp file ${tempFilePath}`);
          }
        }
      }
    }
  }
  
  // Generate thumbnail from source buffer (either original JPEG or extracted preview)
  return sharp(sourceBuffer)
    .resize(width, null, {
      withoutEnlargement: true, // Don't upscale small images
      fit: 'inside', // Maintain aspect ratio
    })
    .jpeg({ quality: 85, progressive: true }) // Convert to optimized JPEG
    .toBuffer();
}

/**
 * Extract EXIF data from image buffer or RAW file (works with JPEG and RAW formats)
 */
async function extractExifData(imageBuffer: Buffer, filename: string): Promise<ExifData | null> {
  try {
    // Check if it's a RAW file (exifr doesn't support CR3 and many other RAW formats)
    const isRawFile = /\.(cr2|cr3|nef|arw|raf|orf|rw2|dng|pef)$/i.test(filename);
    
    if (isRawFile) {
      // Use exiftool for RAW files
      const tempFilePath = join(tmpdir(), `exif-${Date.now()}-${filename}`);
      
      try {
        // Write buffer to temp file
        await writeFile(tempFilePath, imageBuffer);
        
        // Read EXIF with exiftool
        const tags = await exiftool.read(tempFilePath);
        
        // Clean up temp file
        await unlink(tempFilePath);
        
        // Convert exiftool types to our ExifData types
        // exiftool returns ExifDateTime objects that have a toDate() method
        const dateTimeOriginal = tags.DateTimeOriginal || tags.CreateDate;
        const parsedDate = dateTimeOriginal ? (
          typeof dateTimeOriginal === 'object' && dateTimeOriginal && 'toDate' in dateTimeOriginal
            ? (dateTimeOriginal as any).toDate()
            : typeof dateTimeOriginal === 'string'
            ? new Date(dateTimeOriginal)
            : undefined
        ) : undefined;
        
        // Parse numeric values that might be strings
        const parseFocalLength = (val: any): number | undefined => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const match = val.match(/[\d.]+/);
            return match ? parseFloat(match[0]) : undefined;
          }
          return undefined;
        };
        
        const parseCoordinate = (val: any): number | undefined => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val);
          return undefined;
        };
        
        const parseExposureTime = (val: any): number | undefined => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            // Handle fraction format like "1/40"
            if (val.includes('/')) {
              const [num, den] = val.split('/');
              return parseInt(num) / parseInt(den);
            }
            return parseFloat(val);
          }
          return undefined;
        };
        
        return {
          make: tags.Make,
          model: tags.Model,
          lensModel: tags.LensModel || tags.Lens,
          lensMake: tags.LensMake,
          dateTimeOriginal: parsedDate,
          iso: tags.ISO,
          fNumber: tags.FNumber || tags.ApertureValue,
          exposureTime: parseExposureTime(tags.ExposureTime || tags.ShutterSpeedValue),
          focalLength: parseFocalLength(tags.FocalLength),
          latitude: parseCoordinate(tags.GPSLatitude),
          longitude: parseCoordinate(tags.GPSLongitude),
          artist: tags.Artist,
          copyright: tags.Copyright,
          orientation: tags.Orientation,
          // Extract actual RAW file dimensions
          imageWidth: tags.ImageWidth || tags.ExifImageWidth,
          imageHeight: tags.ImageHeight || tags.ExifImageHeight
        };
      } catch (exiftoolError) {
        const errorMessage = exiftoolError instanceof Error ? exiftoolError.message : 'Unknown error';
        console.warn(`exiftool EXIF extraction failed: ${errorMessage}`);
        
        // Clean up temp file if it exists
        try {
          await unlink(tempFilePath);
        } catch {}
        
        return null;
      }
    } else {
      // Use exifr for JPEG/TIFF files
      const exif = await exifr.parse(imageBuffer, {
        tiff: true,
        exif: true,
        gps: true,
        pick: [
          'Make', 'Model',
          'LensModel', 'LensMake',
          'DateTimeOriginal', 'CreateDate',
          'ISO', 'FNumber', 'ExposureTime', 'FocalLength',
          'latitude', 'longitude',
          'Artist', 'Copyright',
          'Orientation'
        ]
      });

      if (!exif) {
        return null;
      }

      return {
        make: exif.Make,
        model: exif.Model,
        lensModel: exif.LensModel,
        lensMake: exif.LensMake,
        dateTimeOriginal: exif.DateTimeOriginal || exif.CreateDate,
        iso: exif.ISO,
        fNumber: exif.FNumber,
        exposureTime: exif.ExposureTime,
        focalLength: exif.FocalLength,
        latitude: exif.latitude,
        longitude: exif.longitude,
        artist: exif.Artist,
        copyright: exif.Copyright,
        orientation: exif.Orientation
      };
    }
  } catch (error) {
    // EXIF extraction failed - not all images have EXIF (e.g., screenshots, edited photos)
    // Log the error for debugging but return null to continue processing
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`EXIF extraction failed: ${errorMessage}`);
    return null;
  }
}

/**
 * Format camera name for blob tag (spaces to dashes, max 256 chars)
 */
function formatCameraName(make?: string, model?: string): string {
  if (!make && !model) return '';
  
  let camera = '';
  if (make && model) {
    // Remove redundant make from model (e.g., "Canon" from "Canon EOS 5D")
    const modelWithoutMake = model.replace(new RegExp(`^${make}\\s*`, 'i'), '');
    camera = `${make} ${modelWithoutMake}`.trim();
  } else {
    camera = (make || model || '').trim();
  }
  
  // Convert spaces to dashes and limit length
  return camera.replace(/\s+/g, '-').substring(0, 256);
}

/**
 * Format lens name for blob tag (spaces to dashes, max 256 chars)
 */
function formatLensName(lensModel?: string): string {
  if (!lensModel) return '';
  
  // Convert spaces to dashes and limit length
  return lensModel.replace(/\s+/g, '-').substring(0, 256);
}

/**
 * Format date for blob tag (YYYY-MM-DD)
 */
function formatDateTaken(date?: Date): string {
  if (!date) return new Date().toISOString().split('T')[0];
  
  try {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Format GPS location for blob tag (simplified, no reverse geocoding yet)
 * Returns lat/lon in format: "37.82N-122.48W" or empty string
 */
function formatLocation(latitude?: number, longitude?: number): string {
  if (latitude === undefined || longitude === undefined) return '';
  
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  const latStr = Math.abs(latitude).toFixed(2);
  const lonStr = Math.abs(longitude).toFixed(2);
  
  return `${latStr}${latDir}-${lonStr}${lonDir}`;
}

/**
 * Format user-provided text for blob tag (spaces to dashes, lowercase, max 256 chars)
 * Used for location and custom tags from frontend
 */
function formatUserText(text?: string): string {
  if (!text) return '';
  
  // Convert spaces to dashes, lowercase, and limit length
  return text.trim().replace(/\s+/g, '-').toLowerCase().substring(0, 256);
}

/**
 * Create blob tags from EXIF data and uploaded metadata
 * Priority: Uploaded metadata > EXIF data > defaults
 */
function createBlobTags(
  exif: ExifData | null, 
  author: string = 'default-user',
  uploadedLocation?: string,
  customTags: string[] = []
): BlobTags {
  // Use uploaded location if provided (formatted), otherwise extract from EXIF GPS
  const location = uploadedLocation 
    ? formatUserText(uploadedLocation) 
    : formatLocation(exif?.latitude, exif?.longitude);
  
  return {
    author: formatUserText(author) || 'default-user',
    dateTaken: formatDateTaken(exif?.dateTimeOriginal),
    camera: formatCameraName(exif?.make, exif?.model),
    lens: formatLensName(exif?.lensModel),
    location: location,
    rating: '0',
    customTag1: formatUserText(customTags[0]),
    customTag2: formatUserText(customTags[1]),
    customTag3: formatUserText(customTags[2]),
    favorite: 'false'
  };
}
