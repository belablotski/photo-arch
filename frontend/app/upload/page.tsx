"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { BlockBlobClient } from "@azure/storage-blob";

interface UploadFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error" | "cancelled";
  progress: number;
  error?: string;
  abortController?: AbortController;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const shouldCancelAllRef = useRef(false);

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
    
    try {
      // Update status to uploading with abort controller
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "uploading" as const, progress: 0, abortController } : f
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

      // Step 2: Upload directly to Azure Blob Storage
      const blobClient = new BlockBlobClient(uploadUrl);
      
      await blobClient.uploadData(uploadFile.file, {
        abortSignal: abortController.signal,
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
