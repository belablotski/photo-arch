"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { BlockBlobClient } from "@azure/storage-blob";

interface PhotoMetadata {
  author?: string;
  location?: string;
  customTags?: string[]; // Array of custom tags
}

interface UploadFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error" | "cancelled";
  progress: number;
  error?: string;
  abortController?: AbortController;
  metadata?: PhotoMetadata;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const shouldCancelAllRef = useRef(false);
  
  // Global metadata that applies to all files in the current batch
  const [globalMetadata, setGlobalMetadata] = useState<PhotoMetadata>({
    author: "",
    location: "",
    customTags: []
  });
  const [newTagInput, setNewTagInput] = useState("");

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const imageFiles = Array.from(selectedFiles).filter((file) =>
      file.type.startsWith("image/") || 
      /\.(cr2|cr3|nef|arw|raf|orf|rw2|dng|pef)$/i.test(file.name)
    );

    const newFiles: UploadFile[] = imageFiles.map((file) => ({
      file,
      status: "pending",
      progress: 0,
      metadata: { ...globalMetadata } // Copy global metadata to each file
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadFile = async (index: number) => {
    const uploadFile = files[index];
    const abortController = new AbortController();
    
    // Apply current global metadata to this file before uploading
    const metadataToUpload = { ...globalMetadata };
    
    try {
      // Update status to uploading with abort controller and current metadata
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index 
            ? { ...f, status: "uploading" as const, progress: 0, abortController, metadata: metadataToUpload } 
            : f
        )
      );

      // Step 1: Request SAS token from backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7071/api";
      console.log("apiUrl:", apiUrl);
      const tokenResponse = await fetch(`${apiUrl}/generate-upload-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uploadFile.file.name,
          contentType: uploadFile.file.type || "application/octet-stream",
        }),
        signal: abortController.signal,
      });

      if (!tokenResponse.ok) {
        throw new Error(`Failed to get upload token: ${tokenResponse.statusText}`);
      }

      const { uploadUrl } = await tokenResponse.json();

      // Step 2: Upload directly to Azure Blob Storage with metadata
      const blobClient = new BlockBlobClient(uploadUrl);
      
      // Prepare blob metadata from current global metadata (only non-empty values)
      const blobMetadata: Record<string, string> = {};
      if (metadataToUpload.author) {
        blobMetadata.author = metadataToUpload.author;
      }
      if (metadataToUpload.location) {
        blobMetadata.location = metadataToUpload.location;
      }
      // Store custom tags as separate fields (matches blob index tag structure)
      if (metadataToUpload.customTags && metadataToUpload.customTags.length > 0) {
        if (metadataToUpload.customTags[0]) {
          blobMetadata.customTag1 = metadataToUpload.customTags[0];
        }
        if (metadataToUpload.customTags[1]) {
          blobMetadata.customTag2 = metadataToUpload.customTags[1];
        }
        if (metadataToUpload.customTags[2]) {
          blobMetadata.customTag3 = metadataToUpload.customTags[2];
        }
      }
      
      await blobClient.uploadData(uploadFile.file, {
        abortSignal: abortController.signal,
        metadata: blobMetadata,
        onProgress: (progress) => {
          const percent = Math.round((progress.loadedBytes / uploadFile.file.size) * 100);
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, progress: percent } : f
            )
          );
        },
      });

      // Success!
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "success" as const, progress: 100, abortController: undefined } : f
        )
      );
    } catch (error) {
      // Check if it was cancelled
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Upload cancelled");
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, status: "cancelled" as const, abortController: undefined } : f
          )
        );
      } else {
        console.error("Upload error:", error);
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: "error" as const,
                  error: error instanceof Error ? error.message : "Upload failed",
                  abortController: undefined,
                }
              : f
          )
        );
      }
    }
  };

  const uploadAll = async () => {
    setIsUploadingAll(true);
    shouldCancelAllRef.current = false;
    
    // Create a snapshot of indices to upload
    const indicesToUpload = files
      .map((file, index) => (file.status === "pending" ? index : -1))
      .filter(index => index !== -1);
    
    for (const i of indicesToUpload) {
      // Check if cancel was requested
      if (shouldCancelAllRef.current) {
        console.log("Upload all cancelled by user");
        break;
      }
      
      await uploadFile(i);
    }
    
    setIsUploadingAll(false);
  };

  const cancelUpload = (index: number) => {
    const file = files[index];
    if (file.abortController) {
      file.abortController.abort();
    }
  };

  const cancelAll = () => {
    shouldCancelAllRef.current = true;
    
    // Abort currently uploading files and mark pending files as cancelled
    setFiles((prev) =>
      prev.map((file) => {
        if (file.status === "uploading" && file.abortController) {
          file.abortController.abort();
        }
        if (file.status === "pending" || file.status === "uploading") {
          return { ...file, status: "cancelled" as const, abortController: undefined };
        }
        return file;
      })
    );
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "success"));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addCustomTag = () => {
    const tag = newTagInput.trim();
    const currentTags = globalMetadata.customTags || [];
    
    // Limit to 3 custom tags (matches blob index tag limit)
    if (currentTags.length >= 3) {
      return; // Don't add more than 3 tags
    }
    
    if (tag && !currentTags.includes(tag)) {
      setGlobalMetadata(prev => ({
        ...prev,
        customTags: [...(prev.customTags || []), tag]
      }));
      setNewTagInput("");
    }
  };

  const removeCustomTag = (tagToRemove: string) => {
    setGlobalMetadata(prev => ({
      ...prev,
      customTags: prev.customTags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">
            📸 Photo Archive
          </Link>
          <nav className="flex gap-4">
            <Link
              href="/gallery"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Gallery
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Upload Photos
        </h1>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-700"
          }`}
        >
          <div className="text-6xl mb-4">☁️</div>
          <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">
            Drag and drop photos here, or click to select
          </p>
          <input
            type="file"
            multiple
            accept="image/*,.cr2,.cr3,.nef,.arw,.raf,.orf,.rw2,.dng,.pef"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="file-input"
          />
          <label
            htmlFor="file-input"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg cursor-pointer transition-colors"
          >
            Select Files
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Supports JPEG, PNG, and RAW files (CR3, CR2, NEF, ARW, etc.)
          </p>
        </div>

        {/* Metadata Form */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Photo Metadata (Optional)
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This metadata will be automatically applied when you upload photos. Especially useful for fields missing in EXIF data.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Author Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Author / Photographer
              </label>
              <input
                type="text"
                value={globalMetadata.author || ""}
                onChange={(e) => setGlobalMetadata(prev => ({ ...prev, author: e.target.value }))}
                placeholder="e.g., John Doe"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Location Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Location
              </label>
              <input
                type="text"
                value={globalMetadata.location || ""}
                onChange={(e) => setGlobalMetadata(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., San Francisco, CA"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Custom Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Tags (Max 3)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Add up to 3 searchable custom tags. These will be indexed for fast filtering in the gallery.
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                placeholder={
                  (globalMetadata.customTags?.length || 0) >= 3 
                    ? "Maximum 3 tags reached" 
                    : "Enter a tag and press Enter or click Add"
                }
                disabled={(globalMetadata.customTags?.length || 0) >= 3}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
              <button
                onClick={addCustomTag}
                disabled={(globalMetadata.customTags?.length || 0) >= 3}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Tag
              </button>
            </div>
            
            {/* Display Tags */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2 flex-1">
                {globalMetadata.customTags && globalMetadata.customTags.length > 0 ? (
                  globalMetadata.customTags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeCustomTag(tag)}
                        className="hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No tags added yet</p>
                )}
              </div>
              {globalMetadata.customTags && globalMetadata.customTags.length > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
                  {globalMetadata.customTags.length}/3
                </span>
              )}
            </div>
          </div>

          {/* Info message */}
          {files.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              ℹ️ Metadata will be automatically applied to photos when you upload them.
            </p>
          )}
        </div>

        {/* Upload Queue */}
        {files.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upload Queue ({files.length} {files.length === 1 ? 'file' : 'files'} / {formatFileSize(files.reduce((total, f) => total + f.file.size, 0))})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={uploadAll}
                  disabled={files.every((f) => f.status !== "pending") || isUploadingAll}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Upload All
                </button>
                {isUploadingAll && (
                  <button
                    onClick={cancelAll}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel All
                  </button>
                )}
                <button
                  onClick={clearCompleted}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Clear Completed
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-2xl">
                        {file.status === "success" && "✅"}
                        {file.status === "error" && "❌"}
                        {file.status === "uploading" && "⏳"}
                        {file.status === "pending" && "📄"}
                        {file.status === "cancelled" && "🚫"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.file.size)}
                          {file.status === "cancelled" && " - Cancelled"}
                        </p>
                      </div>
                    </div>
                    {file.status === "pending" && (
                      <button
                        onClick={() => uploadFile(index)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Upload
                      </button>
                    )}
                    {file.status === "uploading" && (
                      <button
                        onClick={() => cancelUpload(index)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {file.status === "uploading" && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error Message */}
                  {file.status === "error" && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      {file.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
