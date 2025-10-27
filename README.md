# Photo Archive

An open-source, cloud-native photo archiving solution built on Azure, providing cost-effective long-term storage with intelligent image processing and search capabilities.

**Note:** This is under development and not ready for use! But you're welcome to fork it or to contribute.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Infrastructure Setup](#infrastructure-setup)
  - [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Photo Archive is a serverless application that enables users to:
- Upload photos directly to Azure Blob Storage
- Automatically process images (thumbnails, AI tagging)
- Search and browse photos through a modern web interface
- Benefit from automatic cost optimization via storage tiering

## ✨ Features

- **Direct Upload**: Client-side uploads using SAS tokens (no server bottleneck)
- **Automated Processing**: Event-driven thumbnail generation and AI analysis
- **Smart Storage**: Lifecycle policies automatically move photos to cheaper tiers
- **Secure**: Azure AD authentication with fine-grained access control
- **Cost-Effective**: Pay-per-use serverless architecture
- **Scalable**: Cloud-native design handles growth automatically

## 🏗️ Architecture

The system consists of three main components:

1. **Frontend**: React SPA hosted as a static website on Azure Blob Storage
2. **Backend**: Azure Functions for API endpoints and image processing
3. **Storage**: Azure Blob Storage with lifecycle management

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Request SAS Token
       ▼
┌─────────────────┐
│ Azure Functions │
│   (Backend)     │
└────────┬────────┘
         │ 2. Generate SAS
         ▼
┌──────────────────┐      3. Upload       ┌──────────────────┐
│  Landing Zone    │ ◄─────────────────── │     Browser      │
│  (Blob Storage)  │                      └──────────────────┘
└────────┬─────────┘
         │ 4. BlobCreated Event
         ▼
┌─────────────────┐
│ Process Image   │
│   (Function)    │
└────────┬────────┘
         │ 5. Generate Thumbnail + AI Tags
         ▼
┌──────────────────┐
│ Photos Container │ (Hot → Cool → Archive)
│ Thumbnails       │
└──────────────────┘
```

For detailed design, see [DESIGN.md](./DESIGN.md).

## 🚀 Getting Started

### Prerequisites

- **Azure Subscription**: [Create a free account](https://azure.microsoft.com/free/)
- **Azure CLI**: [Installation guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Node.js**: Version 18.x or later
- **Git**: For version control
- **jq**: JSON processor (`sudo apt-get install jq` on Linux)

### Infrastructure Setup

#### Step 1: Clone the Repository

```bash
git clone https://github.com/belablotski/photo-arch.git
cd photo-arch
```

#### Step 2: Login to Azure

```bash
az login
```

Select your subscription:

```bash
az account list --output table
az account set --subscription "Your Subscription Name"
```

#### Step 3: Deploy Infrastructure

Deploy to the development environment:

```bash
chmod +x scripts/*.sh
./scripts/deploy.sh dev
```

This will:
- Create a resource group `photo-archive-dev-rg`
- Deploy storage account with containers:
  - `landing-zone` - Temporary upload storage
  - `photos` - Permanent photo archive
  - `thumbnails` - Generated thumbnails
  - `$web` - Static website hosting
- Configure lifecycle policies for cost optimization
- Enable blob versioning and soft delete

**Deployment takes approximately 2-3 minutes.**

#### Step 4: Verify Deployment

Check the deployment outputs:

```bash
cat .azure/dev-outputs.json
```

You should see:
```json
{
  "storageAccountName": "photoarchdevXXXXXXXXst",
  "webEndpoint": "https://photoarchdevXXXXXXXXst.z13.web.core.windows.net/",
  "resourceGroup": "photo-archive-dev-rg",
  "deploymentName": "photo-archive-20251026-143052",
  "deploymentDate": "2025-10-26T14:30:52Z"
}
```

#### Step 5: View Resources in Azure Portal

Visit the [Azure Portal](https://portal.azure.com) and navigate to the `photo-archive-dev-rg` resource group.

### Local Development

#### Step 1: Setup Local Environment

```bash
./scripts/setup-local.sh dev
```

This creates:
- `local.settings.json` - Azure Functions configuration
- `.env.local` - Frontend environment variables

#### Step 2: Install Dependencies

```bash
npm install
```

#### Step 3: Start Development Servers

```bash
# Terminal 1: Start Azure Functions
npm run start:functions

# Terminal 2: Start React frontend
npm run start:web
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:7071

## 📁 Project Structure

```
photo-arch/
├── infrastructure/           # Infrastructure as Code
│   ├── main.bicep           # Main Bicep template
│   ├── modules/             # Bicep modules
│   │   └── storage.bicep    # Storage configuration
│   └── parameters/          # Environment-specific parameters
│       ├── dev.bicepparam
│       ├── staging.bicepparam
│       └── prod.bicepparam
├── scripts/                 # Deployment & operational scripts
│   ├── deploy.sh            # Main deployment script
│   ├── setup-local.sh       # Local development setup
│   └── teardown.sh          # Resource cleanup
├── src/
│   ├── functions/           # Azure Functions (backend)
│   └── web/                 # React frontend
├── docs/                    # Additional documentation
├── .azure/                  # Deployment outputs (gitignored)
├── DESIGN.md                # Technical design document
├── PRODUCT_DOCUMENT.md      # Product requirements
└── README.md                # This file
```

## 📚 Documentation

- [PRODUCT_DOCUMENT.md](./PRODUCT_DOCUMENT.md) - Product vision and requirements
- [DESIGN.md](./DESIGN.md) - Technical architecture and design decisions
- [Infrastructure Setup](./docs/infrastructure-setup.md) - Detailed infrastructure guide *(coming soon)*
- [API Documentation](./docs/api.md) - Backend API reference *(coming soon)*
- [Frontend Guide](./docs/frontend.md) - Frontend development guide *(coming soon)*

## 🛠️ Development Workflow

### Deploy to Different Environments

```bash
# Development
./scripts/deploy.sh dev

# Staging
./scripts/deploy.sh staging

# Production
./scripts/deploy.sh prod
```

### Update Infrastructure

1. Modify Bicep templates in `infrastructure/`
2. Test changes with what-if:
   ```bash
   az deployment group what-if \
     --resource-group photo-archive-dev-rg \
     --template-file infrastructure/main.bicep \
     --parameters infrastructure/parameters/dev.bicepparam
   ```
3. Deploy changes:
   ```bash
   ./scripts/deploy.sh dev
   ```

### Cleanup Resources

⚠️ **Warning**: This permanently deletes all data!

```bash
./scripts/teardown.sh dev
```

## 🧪 Testing

*(Coming soon)*

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Azure serverless technologies
- Inspired by the need for affordable, long-term photo storage
- Community-driven and open-source

## 📞 Support

- 🐛 [Report a bug](https://github.com/belablotski/photo-arch/issues)
- 💡 [Request a feature](https://github.com/belablotski/photo-arch/issues)
- 💬 [Discussions](https://github.com/belablotski/photo-arch/discussions)

---

Made with ❤️ by the Photo Archive community