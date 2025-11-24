# Photo Archive Frontend

Next.js frontend for the Photo Archive application with direct-to-Azure uploads.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Storage SDK**: @azure/storage-blob (client-side uploads)

## Features

- ✅ Drag-and-drop photo upload
- ✅ Direct-to-Azure Blob Storage uploads (no backend proxy)
- ✅ Progress tracking for each upload
- ✅ Support for JPEG, PNG, and RAW files (CR3, CR2, NEF, ARW, etc.)
- ✅ Responsive design with dark mode support

## Getting Started

### Prerequisites

- Node.js 18 or later
- Backend Azure Functions running (see `../backend/README.md`)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

3. Update `.env.local` with your backend API URL:
   ```bash
   # For local development
   NEXT_PUBLIC_API_URL=http://localhost:7071/api
   
   # For production
   # NEXT_PUBLIC_API_URL=https://your-function-app.azurewebsites.net/api
   ```

### Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
