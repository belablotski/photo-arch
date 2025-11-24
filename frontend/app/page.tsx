import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            📸 Photo Archive
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
            Professional photo management with RAW support, EXIF extraction, and intelligent deduplication
          </p>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="text-4xl mb-4">☁️</div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Upload Photos
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Direct-to-cloud uploads with automatic thumbnail generation and EXIF extraction
              </p>
              <Link
                href="/upload"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Start Uploading
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="text-4xl mb-4">🖼️</div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                View Gallery
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Browse your photos with metadata, filtering by camera, date, and lens
              </p>
              <Link
                href="/gallery"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Open Gallery
              </Link>
            </div>
          </div>

          {/* Features List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              ✨ Features
            </h3>
            <ul className="grid md:grid-cols-2 gap-4 text-left text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>RAW file support (CR3, CR2, NEF, ARW, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Automatic EXIF extraction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Content-based deduplication</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Automatic thumbnail generation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Filter by camera, lens, and date</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Secure Azure Blob Storage</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
