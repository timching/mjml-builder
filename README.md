# MJML Builder

Build standalone MJML binaries for multiple platforms and Node.js versions.

[![Build Status](https://github.com/timching/mjml-builder/actions/workflows/build.yml/badge.svg)](https://github.com/timching/mjml-builder/actions/workflows/build.yml)
[![Release](https://github.com/timching/mjml-builder/actions/workflows/release.yml/badge.svg)](https://github.com/timching/mjml-builder/actions/workflows/release.yml)

## Overview

This project creates standalone MJML binaries that can be used without Node.js installed. Each binary packages the MJML compiler into a single executable file.

## Supported Platforms

| Platform | Architecture | Binary Name |
|----------|-------------|-------------|
| macOS | x64 (Intel) | `mjml-darwin-x64-node{version}` |
| macOS | arm64 (Apple Silicon) | `mjml-darwin-arm64-node{version}` |
| Linux | x64 | `mjml-linux-x64-node{version}` |
| Linux | arm64 | `mjml-linux-arm64-node{version}` |

## Supported Node.js Versions

| Version | Codename | Status |
|---------|----------|--------|
| Node.js 16 | Gallium | ✅ Supported |
| Node.js 18 | Hydrogen | ✅ Supported |
| Node.js 20 | Iron | ✅ Supported |
| Node.js 22 | Jod | ✅ Supported |
| Node.js 24 | TBD | ⏳ Pending pkg support |

> **Note**: Non-LTS versions (17, 19, 21, 23) are not supported by the pkg build tool.

---

## Quick Start

### Download Pre-built Binaries

Download from [GitHub Releases](https://github.com/timching/mjml-builder/releases).

### Build Locally

```bash
# Clone the repository
git clone https://github.com/timching/mjml-builder.git
cd mjml-builder

# Install dependencies
npm install

# Build all binaries
npm run build:all

# Or build specific platform/version
npm run build -- --platform linux-x64 --node 20
```

---

## GitHub Repository Setup

Follow these steps to push this repo to GitHub and run the CI/CD workflows.

### Step 1: Create GitHub Repository

```bash
# Go to GitHub and create a new repository named "mjml-builder"
# URL: https://github.com/new
# - Repository name: mjml-builder
# - Visibility: Public or Private
# - Do NOT initialize with README (we already have one)
```

### Step 2: Initialize and Push

```bash
cd /Users/timyuen/sandbox/mjml-builder

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: MJML binary builder"

# Add remote origin (replace 'timching' with your GitHub username)
git remote add origin https://github.com/timching/mjml-builder.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify GitHub Actions

1. Go to your repository: `https://github.com/timching/mjml-builder`
2. Click on **Actions** tab
3. You should see the "Build MJML Binaries" workflow

---

## Triggering GitHub Actions

### Automatic Triggers

| Event | Workflow | Description |
|-------|----------|-------------|
| Push to `main` | Build | Builds all binaries |
| Push to `develop` | Build | Builds all binaries |
| Pull Request to `main` | Build | Builds all binaries |
| Push tag `v*.*.*` | Release | Builds + Creates GitHub Release |

### Manual Trigger (Recommended for Testing)

#### Option 1: GitHub Web UI

1. Go to **Actions** tab in your repository
2. Click **"Build MJML Binaries"** workflow on the left
3. Click **"Run workflow"** button (dropdown on right)
4. Select options:
   - **Branch**: `main`
   - **Platforms**: `all` or specific like `linux-x64,macos-arm64`
   - **Node versions**: `all` or specific like `20,22`
5. Click **"Run workflow"** green button

#### Option 2: GitHub CLI

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md

# Authenticate with GitHub
gh auth login

# Trigger build workflow manually
gh workflow run build.yml

# Trigger with specific platforms
gh workflow run build.yml -f platforms="linux-x64,macos-arm64" -f node_versions="20,22"

# Watch the workflow run
gh run watch
```

### Creating a Release

#### Option 1: Git Tag (Recommended)

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# This automatically triggers the release workflow which:
# 1. Builds all binaries
# 2. Verifies SHA256 hashes
# 3. Creates ZIP packages
# 4. Publishes GitHub Release with all assets
```

#### Option 2: Manual Release Trigger

1. Go to **Actions** → **"Release MJML Binaries"**
2. Click **"Run workflow"**
3. Enter version (e.g., `v1.0.0`)
4. Choose if draft release
5. Click **"Run workflow"**

---

## Configuration

### Build Configuration

Edit `config/build-config.json` to customize builds:

```json
{
  "platforms": {
    "macos-x64": { "enabled": true },
    "macos-arm64": { "enabled": true },
    "linux-x64": { "enabled": true },
    "linux-arm64": { "enabled": true },
    "windows-x64": { "enabled": false },
    "windows-arm64": { "enabled": false }
  },
  "nodeVersions": {
    "16": { "enabled": true, "supported": true },
    "18": { "enabled": true, "supported": true },
    "20": { "enabled": true, "supported": true },
    "22": { "enabled": true, "supported": true },
    "24": { "enabled": false, "supported": false }
  }
}
```

### Enable/Disable Builds

Simply set `"enabled": false` for any platform or Node version you don't need.

---

## CLI Usage

### Basic Commands

```bash
# Compile MJML file to HTML
./mjml input.mjml -o output.html

# Read from stdin
cat input.mjml | ./mjml --stdin > output.html

# With strict validation
./mjml input.mjml -o output.html --validation-level strict

# Minify output
./mjml input.mjml -o output.html --minify

# Watch mode
./mjml input.mjml -o output.html --watch
```

### CLI Options

```
Usage: mjml [options] [input]

Arguments:
  input                      Input MJML file (reads from stdin if not provided)

Options:
  -V, --version              Output version number
  -o, --output <file>        Output file (stdout if not provided)
  -c, --config <file>        Path to MJML config file
  --validation-level <level> strict, soft, or skip (default: soft)
  --minify                   Minify the output HTML
  --beautify                 Beautify the output HTML
  -w, --watch                Watch for file changes
  --stdin                    Force reading from stdin
  -s, --silent               Suppress console output
  -h, --help                 Display help
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build with default settings |
| `npm run build:all` | Build all enabled platforms/versions |
| `npm run build -- --platform <name>` | Build specific platform |
| `npm run build -- --node <version>` | Build specific Node version |
| `npm run build -- --dry-run` | Preview without building |
| `npm run verify` | Verify SHA256 hashes |
| `npm run package` | Create ZIP archives |
| `npm run clean -- --force` | Clean dist directory |

---

## Verifying Downloads

### macOS / Linux

```bash
# Verify all files
shasum -a 256 -c SHA256SUMS.txt

# Verify single file
shasum -a 256 mjml-linux-x64-node20.zip
```

### Windows PowerShell

```powershell
Get-FileHash mjml-win32-x64-node20.zip -Algorithm SHA256
```

---

## Project Structure

```
mjml-builder/
├── .github/workflows/
│   ├── build.yml           # CI: Build all binaries
│   └── release.yml         # CD: Create GitHub releases
├── config/
│   ├── build-config.json   # Build matrix configuration
│   └── build-config.schema.json
├── scripts/
│   ├── build.js            # Main build script
│   ├── verify-hash.js      # Hash verification
│   ├── package-binary.js   # ZIP packaging
│   └── clean.js            # Cleanup utility
├── src/
│   ├── cli.js              # CLI entry point
│   └── index.js            # Module exports
├── examples/
│   └── sample.mjml         # Test template
├── dist/                   # Built binaries (gitignored)
├── package.json
├── README.md
└── LICENSE
```

---

## Build Matrix

**Current configuration: 4 platforms × 4 Node versions = 16 binaries**

| Platform | Node 16 | Node 18 | Node 20 | Node 22 |
|----------|---------|---------|---------|---------|
| macos-x64 | ✅ | ✅ | ✅ | ✅ |
| macos-arm64 | ✅ | ✅ | ✅ | ✅ |
| linux-x64 | ✅ | ✅ | ✅ | ✅ |
| linux-arm64 | ✅ | ✅ | ✅ | ✅ |

---

## Troubleshooting

### GitHub Actions Not Running

1. Check that workflows are in `.github/workflows/` directory
2. Ensure you pushed to `main` branch
3. Go to **Actions** tab and check if workflows are enabled
4. Click **"I understand my workflows, go ahead and enable them"** if prompted

### Build Fails for Specific Platform

1. Check if the platform is enabled in `config/build-config.json`
2. Verify Node version is supported (`supported: true`)
3. Check GitHub Actions logs for detailed error messages

### Permission Denied on Binary

```bash
chmod +x mjml-linux-x64-node20
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [MJML](https://mjml.io/) - The responsive email framework
- [@yao-pkg/pkg](https://github.com/yao-pkg/pkg) - Node.js binary compiler
