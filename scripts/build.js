#!/usr/bin/env node

/**
 * MJML Binary Builder
 * Builds MJML binaries for configured platforms and Node.js versions
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');

const execAsync = util.promisify(exec);

// Load configuration
const configPath = path.join(__dirname, '..', 'config', 'build-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  all: args.includes('--all'),
  platform: getArgValue(args, '--platform'),
  nodeVersion: getArgValue(args, '--node'),
  single: args.includes('--single'),
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose') || args.includes('-v')
};

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

/**
 * Generate build matrix from configuration
 */
function generateBuildMatrix() {
  const matrix = [];

  const enabledPlatforms = Object.entries(config.platforms)
    .filter(([_, cfg]) => cfg.enabled)
    .filter(([name]) => !options.platform || name === options.platform);

  const enabledNodeVersions = Object.entries(config.nodeVersions)
    .filter(([_, cfg]) => cfg.enabled && cfg.supported)
    .filter(([version]) => !options.nodeVersion || version === options.nodeVersion);

  for (const [platformName, platformConfig] of enabledPlatforms) {
    for (const [nodeVersion, nodeConfig] of enabledNodeVersions) {
      matrix.push({
        platform: platformName,
        platformConfig,
        nodeVersion,
        nodeConfig,
        target: `${nodeConfig.pkgTarget}-${platformConfig.pkgTarget}`,
        outputName: getBinaryName(platformConfig, nodeVersion)
      });
    }
  }

  return matrix;
}

/**
 * Get binary filename for a given platform and node version
 */
function getBinaryName(platformConfig, nodeVersion) {
  const prefix = config.output.binaryPrefix;
  const ext = platformConfig.extension || '';
  return `${prefix}-${platformConfig.artifactName}-node${nodeVersion}${ext}`;
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  const outputDir = path.join(__dirname, '..', config.output.directory);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

/**
 * Generate SHA256 hash for a file
 */
function generateHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash(config.output.hashAlgorithm);
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Build a single target
 */
async function buildTarget(target, outputDir) {
  const outputPath = path.join(outputDir, target.outputName);

  console.log(`\n🔨 Building: ${target.outputName}`);
  console.log(`   Target: ${target.target}`);

  if (options.dryRun) {
    console.log(`   [DRY RUN] Would build to: ${outputPath}`);
    return { success: true, dryRun: true };
  }

  const pkgCommand = [
    'npx',
    '@yao-pkg/pkg',
    '.',
    '--target', target.target,
    '--output', outputPath,
    '--compress', 'GZip'
  ].join(' ');

  if (options.verbose) {
    console.log(`   Command: ${pkgCommand}`);
  }

  try {
    const { stdout, stderr } = await execAsync(pkgCommand, {
      cwd: path.join(__dirname, '..'),
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });

    if (options.verbose && stdout) {
      console.log(stdout);
    }

    // Verify binary was created
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Binary not created: ${outputPath}`);
    }

    const stats = fs.statSync(outputPath);
    const hash = generateHash(outputPath);

    // Write hash file
    const hashFile = `${outputPath}.${config.output.hashAlgorithm}`;
    fs.writeFileSync(hashFile, `${hash}  ${target.outputName}\n`);

    console.log(`   ✅ Success: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   📝 Hash: ${hash.substring(0, 16)}...`);

    return {
      success: true,
      outputPath,
      size: stats.size,
      hash
    };

  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    if (options.verbose && error.stderr) {
      console.error(error.stderr);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Build targets with concurrency control
 */
async function buildWithConcurrency(matrix, outputDir, maxConcurrency) {
  const results = [];
  const queue = [...matrix];

  async function worker() {
    while (queue.length > 0) {
      const target = queue.shift();
      if (target) {
        const result = await buildTarget(target, outputDir);
        results.push({ target, result });
      }
    }
  }

  const workers = Array(Math.min(maxConcurrency, matrix.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Main build function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    MJML Binary Builder                     ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Generate build matrix
  const matrix = generateBuildMatrix();

  if (matrix.length === 0) {
    console.log('No build targets enabled. Check your build-config.json');
    process.exit(1);
  }

  console.log(`📋 Build Matrix: ${matrix.length} target(s)`);
  matrix.forEach(t => console.log(`   - ${t.outputName}`));

  // Prepare output directory
  const outputDir = ensureOutputDir();

  if (config.build.cleanBeforeBuild && !options.single) {
    console.log('\n🧹 Cleaning output directory...');
    const files = fs.readdirSync(outputDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(outputDir, file));
    });
  }

  // Build
  console.log('\n🚀 Starting builds...');
  const startTime = Date.now();

  let results;
  if (config.build.parallel && matrix.length > 1) {
    results = await buildWithConcurrency(matrix, outputDir, config.build.maxConcurrency);
  } else {
    results = [];
    for (const target of matrix) {
      const result = await buildTarget(target, outputDir);
      results.push({ target, result });
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successful = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                       Build Summary                        ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Total:      ${results.length}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed:     ${failed}`);
  console.log(`   Duration:   ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Write manifest
  if (successful > 0) {
    const manifest = {
      version: require('../package.json').version,
      buildTime: new Date().toISOString(),
      builds: results
        .filter(r => r.result.success)
        .map(r => ({
          name: r.target.outputName,
          platform: r.target.platform,
          nodeVersion: r.target.nodeVersion,
          hash: r.result.hash,
          size: r.result.size
        }))
    };

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`📄 Manifest written: ${manifestPath}`);
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
