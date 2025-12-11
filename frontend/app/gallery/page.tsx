'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Photo {
  id: string;
  originalFilename: string;
  thumbnailUrl: string;
  previewUrl: string;
  photoUrl: string;
  uploadDate: string;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  tags: {
    author?: string;
    dateTaken?: string;
    camera?: string;
    lens?: string;
    location?: string;
    rating?: string;
    customTag1?: string;
    customTag2?: string;
    customTag3?: string;
    favorite?: string;
  };
}

interface ApiResponse {
  photos: Photo[];
  continuationToken?: string;
  hasMore: boolean;
  totalReturned: number;
}

export default function GalleryPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Fetch photos from API
  const fetchPhotos = useCallback(async (token?: string) => {
    try {
      if (token) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const url = token 
        ? `http://localhost:7071/api/photos?limit=20&continuationToken=${encodeURIComponent(token)}`
        : `http://localhost:7071/api/photos?limit=20`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const data: ApiResponse = await response.json();
      
      if (token) {
        // Append to existing photos (infinite scroll)
        setPhotos(prev => [...prev, ...data.photos]);
      } else {
        // Replace photos (initial load)
        setPhotos(data.photos);
      }

      setContinuationToken(data.continuationToken);
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && continuationToken) {
          fetchPhotos(continuationToken);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, continuationToken, fetchPhotos]);

  // Auto-load more photos when approaching the end in lightbox
  useEffect(() => {
    if (selectedPhotoIndex === null) return;
    
    // If viewing last 3 photos and more photos are available, load them
    const isNearEnd = selectedPhotoIndex >= photos.length - 3;
    if (isNearEnd && hasMore && !loadingMore && continuationToken) {
      fetchPhotos(continuationToken);
    }
  }, [selectedPhotoIndex, photos.length, hasMore, loadingMore, continuationToken, fetchPhotos]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return;

      if (e.key === 'Escape') {
        setSelectedPhotoIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setSelectedPhotoIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'ArrowRight') {
        setSelectedPhotoIndex(prev => prev !== null && prev < photos.length - 1 ? prev + 1 : prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIndex, photos.length]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format camera name (remove dashes, capitalize)
  const formatCamera = (camera?: string) => {
    if (!camera) return '';
    return camera.replace(/-/g, ' ');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Photo Gallery</h1>
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                ← Home
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Photo Gallery</h1>
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                ← Home
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <p className="font-semibold">Error loading photos</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={() => fetchPhotos()}
              className="mt-3 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Photo Gallery</h1>
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                ← Home
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No photos</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by uploading some photos.</p>
            <div className="mt-6">
              <Link
                href="/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Upload Photos
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const selectedPhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Photo Gallery</h1>
            <div className="flex gap-4 items-center">
              <span className="text-sm text-gray-600">
                {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </span>
              <Link href="/upload" className="text-blue-600 hover:text-blue-800">
                Upload
              </Link>
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Gallery Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative group cursor-pointer aspect-square overflow-hidden rounded-lg bg-gray-200 hover:opacity-90 transition-opacity"
              onClick={() => setSelectedPhotoIndex(index)}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.originalFilename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Hover overlay with metadata */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-sm">
                  <p className="font-semibold truncate">{photo.originalFilename}</p>
                  {photo.tags.camera && (
                    <p className="text-xs opacity-90 truncate">{formatCamera(photo.tags.camera)}</p>
                  )}
                  {photo.tags.dateTaken && (
                    <p className="text-xs opacity-90">{formatDate(photo.tags.dateTaken)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-8">
            {loadingMore && (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            )}
          </div>
        )}

        {/* End of photos message */}
        {!hasMore && photos.length > 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            You've reached the end of the gallery
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-3xl w-10 h-10 flex items-center justify-center"
            onClick={() => setSelectedPhotoIndex(null)}
          >
            ×
          </button>

          {/* Previous button */}
          {selectedPhotoIndex !== null && selectedPhotoIndex > 0 && (
            <button
              className="absolute left-4 text-white hover:text-gray-300 text-5xl w-12 h-12 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPhotoIndex(prev => prev !== null ? prev - 1 : prev);
              }}
            >
              ‹
            </button>
          )}

          {/* Next button */}
          {selectedPhotoIndex !== null && (selectedPhotoIndex < photos.length - 1 || (hasMore && !loadingMore)) && (
            <button
              className="absolute right-4 text-white hover:text-gray-300 text-5xl w-12 h-12 flex items-center justify-center disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                if (selectedPhotoIndex < photos.length - 1) {
                  setSelectedPhotoIndex(prev => prev !== null ? prev + 1 : prev);
                }
              }}
              disabled={selectedPhotoIndex >= photos.length - 1}
            >
              {selectedPhotoIndex >= photos.length - 1 && loadingMore ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              ) : (
                '›'
              )}
            </button>
          )}

          {/* Photo and metadata container */}
          <div
            className="max-w-7xl w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col lg:flex-row gap-4 max-h-full">
              {/* Photo */}
              <div className="flex-1 flex items-center justify-center">
                <img
                  src={selectedPhoto.previewUrl}
                  alt={selectedPhoto.originalFilename}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </div>

              {/* Metadata panel */}
              <div className="lg:w-80 bg-gray-900 text-white p-6 rounded-lg overflow-y-auto max-h-[80vh]">
                <h2 className="text-lg font-semibold mb-4 truncate">
                  {selectedPhoto.originalFilename}
                </h2>

                {/* Photo info */}
                <div className="space-y-3 text-sm">
                  {selectedPhoto.tags.dateTaken && (
                    <div>
                      <span className="text-gray-400">Date Taken:</span>
                      <p className="font-medium">{formatDate(selectedPhoto.tags.dateTaken)}</p>
                    </div>
                  )}

                  {selectedPhoto.tags.camera && (
                    <div>
                      <span className="text-gray-400">Camera:</span>
                      <p className="font-medium">{formatCamera(selectedPhoto.tags.camera)}</p>
                    </div>
                  )}

                  {selectedPhoto.tags.lens && (
                    <div>
                      <span className="text-gray-400">Lens:</span>
                      <p className="font-medium">{formatCamera(selectedPhoto.tags.lens)}</p>
                    </div>
                  )}

                  {selectedPhoto.tags.author && (
                    <div>
                      <span className="text-gray-400">Author:</span>
                      <p className="font-medium">{selectedPhoto.tags.author}</p>
                    </div>
                  )}

                  {selectedPhoto.tags.location && (
                    <div>
                      <span className="text-gray-400">Location:</span>
                      <p className="font-medium">{formatCamera(selectedPhoto.tags.location)}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-gray-400">Dimensions:</span>
                    <p className="font-medium">
                      {selectedPhoto.dimensions.width} × {selectedPhoto.dimensions.height}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400">Format:</span>
                    <p className="font-medium uppercase">{selectedPhoto.format}</p>
                  </div>

                  <div>
                    <span className="text-gray-400">File Size:</span>
                    <p className="font-medium">
                      {(selectedPhoto.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  {/* Custom tags */}
                  {(selectedPhoto.tags.customTag1 || selectedPhoto.tags.customTag2 || selectedPhoto.tags.customTag3) && (
                    <div>
                      <span className="text-gray-400">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPhoto.tags.customTag1 && (
                          <span className="px-2 py-1 bg-blue-600 rounded text-xs">
                            {selectedPhoto.tags.customTag1}
                          </span>
                        )}
                        {selectedPhoto.tags.customTag2 && (
                          <span className="px-2 py-1 bg-blue-600 rounded text-xs">
                            {selectedPhoto.tags.customTag2}
                          </span>
                        )}
                        {selectedPhoto.tags.customTag3 && (
                          <span className="px-2 py-1 bg-blue-600 rounded text-xs">
                            {selectedPhoto.tags.customTag3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <a
                    href={selectedPhoto.photoUrl}
                    download
                    className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Download Original
                  </a>
                </div>

                {/* Navigation hint */}
                <div className="mt-4 text-xs text-gray-500 text-center">
                  Use ← → arrow keys to navigate
                  <br />
                  Press ESC to close
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
