#!/usr/bin/env node

/**
 * Hash Verification Script
 * Verifies SHA256 hashes of built binaries
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load configuration
const configPath = path.join(__dirname, '..', 'config', 'build-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const args = process.argv.slice(2);
const options = {
  file: getArgValue(args, '--file'),
  hash: getArgValue(args, '--hash'),
  manifest: args.includes('--manifest'),
  verbose: args.includes('--verbose') || args.includes('-v')
};

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

/**
 * Calculate hash of a file
 */
function calculateHash(filePath, algorithm = 'sha256') {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash(algorithm);
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Verify a single file against its hash file
 */
function verifyFile(filePath) {
  const hashFilePath = `${filePath}.${config.output.hashAlgorithm}`;

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Binary file not found' };
  }

  if (!fs.existsSync(hashFilePath)) {
    return { success: false, error: 'Hash file not found' };
  }

  const hashContent = fs.readFileSync(hashFilePath, 'utf8').trim();
  const expectedHash = hashContent.split(/\s+/)[0];
  const actualHash = calculateHash(filePath, config.output.hashAlgorithm);

  return {
    success: expectedHash === actualHash,
    expected: expectedHash,
    actual: actualHash,
    match: expectedHash === actualHash
  };
}

/**
 * Verify file against provided hash
 */
function verifyFileWithHash(filePath, expectedHash) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Binary file not found' };
  }

  const actualHash = calculateHash(filePath, config.output.hashAlgorithm);

  return {
    success: expectedHash === actualHash,
    expected: expectedHash,
    actual: actualHash,
    match: expectedHash === actualHash
  };
}

/**
 * Verify all files in manifest
 */
function verifyManifest() {
  const outputDir = path.join(__dirname, '..', config.output.directory);
  const manifestPath = path.join(outputDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Manifest not found:', manifestPath);
    return false;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`📋 Verifying ${manifest.builds.length} binaries from manifest\n`);
  console.log(`   Build Version: ${manifest.version}`);
  console.log(`   Build Time:    ${manifest.buildTime}\n`);

  let allPassed = true;

  for (const build of manifest.builds) {
    const filePath = path.join(outputDir, build.name);
    const result = verifyFileWithHash(filePath, build.hash);

    if (result.success) {
      console.log(`   ✅ ${build.name}`);
      if (options.verbose) {
        console.log(`      Hash: ${result.actual}`);
      }
    } else {
      console.log(`   ❌ ${build.name}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      } else {
        console.log(`      Expected: ${result.expected}`);
        console.log(`      Actual:   ${result.actual}`);
      }
      allPassed = false;
    }
  }

  return allPassed;
}

/**
 * Verify all files in output directory
 */
function verifyAll() {
  const outputDir = path.join(__dirname, '..', config.output.directory);

  if (!fs.existsSync(outputDir)) {
    console.error('❌ Output directory not found:', outputDir);
    return false;
  }

  const files = fs.readdirSync(outputDir)
    .filter(f => !f.endsWith(`.${config.output.hashAlgorithm}`) &&
                 !f.endsWith('.json') &&
                 !f.endsWith('.zip'));

  if (files.length === 0) {
    console.log('No binary files found to verify');
    return true;
  }

  console.log(`📋 Verifying ${files.length} binaries\n`);

  let allPassed = true;

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const result = verifyFile(filePath);

    if (result.success) {
      console.log(`   ✅ ${file}`);
      if (options.verbose) {
        console.log(`      Hash: ${result.actual}`);
      }
    } else {
      console.log(`   ❌ ${file}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      } else {
        console.log(`      Expected: ${result.expected}`);
        console.log(`      Actual:   ${result.actual}`);
      }
      allPassed = false;
    }
  }

  return allPassed;
}

/**
 * Main function
 */
function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    Hash Verification                       ');
  console.log('═══════════════════════════════════════════════════════════\n');

  let success;

  if (options.file && options.hash) {
    // Verify single file with provided hash
    const result = verifyFileWithHash(options.file, options.hash);
    if (result.success) {
      console.log(`✅ Hash verified: ${options.file}`);
    } else {
      console.log(`❌ Hash mismatch: ${options.file}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      } else {
        console.log(`   Expected: ${result.expected}`);
        console.log(`   Actual:   ${result.actual}`);
      }
    }
    success = result.success;

  } else if (options.file) {
    // Verify single file against its hash file
    const result = verifyFile(options.file);
    if (result.success) {
      console.log(`✅ Hash verified: ${options.file}`);
    } else {
      console.log(`❌ Hash mismatch: ${options.file}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    success = result.success;

  } else if (options.manifest) {
    // Verify all files from manifest
    success = verifyManifest();

  } else {
    // Verify all files in output directory
    success = verifyAll();
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  if (success) {
    console.log('                 ✅ All hashes verified                    ');
  } else {
    console.log('                 ❌ Verification failed                    ');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(success ? 0 : 1);
}

main();
