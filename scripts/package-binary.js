#!/usr/bin/env node

/**
 * Binary Packaging Script
 * Creates ZIP archives for each binary for release
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Load configuration
const configPath = path.join(__dirname, '..', 'config', 'build-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const args = process.argv.slice(2);
const options = {
  file: getArgValue(args, '--file'),
  all: args.includes('--all'),
  verbose: args.includes('--verbose') || args.includes('-v')
};

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

/**
 * Create ZIP archive for a single binary
 */
function createZip(binaryPath) {
  return new Promise((resolve, reject) => {
    const binaryName = path.basename(binaryPath);
    const zipName = binaryName.replace(/\.(exe)?$/, '') + '.zip';
    const zipPath = path.join(path.dirname(binaryPath), zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: config.output.compressionLevel }
    });

    output.on('close', () => {
      resolve({
        zipPath,
        size: archive.pointer()
      });
    });

    archive.on('error', reject);

    archive.pipe(output);

    // Add binary to archive
    archive.file(binaryPath, { name: binaryName });

    // Add hash file if exists
    const hashFile = `${binaryPath}.${config.output.hashAlgorithm}`;
    if (fs.existsSync(hashFile)) {
      archive.file(hashFile, { name: `${binaryName}.${config.output.hashAlgorithm}` });
    }

    // Add README
    const readmePath = path.join(__dirname, '..', 'README.md');
    if (fs.existsSync(readmePath)) {
      archive.file(readmePath, { name: 'README.md' });
    }

    // Add LICENSE if exists
    const licensePath = path.join(__dirname, '..', 'LICENSE');
    if (fs.existsSync(licensePath)) {
      archive.file(licensePath, { name: 'LICENSE' });
    }

    archive.finalize();
  });
}

/**
 * Package all binaries in output directory
 */
async function packageAll() {
  const outputDir = path.join(__dirname, '..', config.output.directory);

  if (!fs.existsSync(outputDir)) {
    console.error('❌ Output directory not found:', outputDir);
    return false;
  }

  // Find all binary files (exclude hash files, manifests, and existing zips)
  const files = fs.readdirSync(outputDir)
    .filter(f => !f.endsWith(`.${config.output.hashAlgorithm}`) &&
                 !f.endsWith('.json') &&
                 !f.endsWith('.zip'));

  if (files.length === 0) {
    console.log('No binary files found to package');
    return true;
  }

  console.log(`📦 Packaging ${files.length} binaries\n`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(outputDir, file);

    try {
      console.log(`   Packaging: ${file}`);
      const result = await createZip(filePath);
      console.log(`   ✅ Created: ${path.basename(result.zipPath)} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);
      results.push({ file, success: true, ...result });
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      results.push({ file, success: false, error: error.message });
    }
  }

  return results.every(r => r.success);
}

/**
 * Package a single binary
 */
async function packageSingle(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('❌ Binary not found:', filePath);
    return false;
  }

  console.log(`📦 Packaging: ${path.basename(filePath)}\n`);

  try {
    const result = await createZip(filePath);
    console.log(`   ✅ Created: ${path.basename(result.zipPath)}`);
    console.log(`   📊 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    Binary Packaging                        ');
  console.log('═══════════════════════════════════════════════════════════\n');

  let success;

  if (options.file) {
    success = await packageSingle(options.file);
  } else {
    success = await packageAll();
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  if (success) {
    console.log('                 ✅ Packaging complete                     ');
  } else {
    console.log('                 ❌ Packaging failed                       ');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(success ? 0 : 1);
}

main();
