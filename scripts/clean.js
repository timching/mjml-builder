#!/usr/bin/env node

/**
 * Clean Script
 * Removes all build artifacts from the dist directory
 */

const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, '..', 'config', 'build-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const args = process.argv.slice(2);
const options = {
  force: args.includes('--force') || args.includes('-f'),
  verbose: args.includes('--verbose') || args.includes('-v')
};

/**
 * Remove directory recursively
 */
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const files = fs.readdirSync(dirPath);
  let count = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      count += removeDir(filePath);
      fs.rmdirSync(filePath);
    } else {
      if (options.verbose) {
        console.log(`   Removing: ${file}`);
      }
      fs.unlinkSync(filePath);
      count++;
    }
  }

  return count;
}

/**
 * Main function
 */
function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                      Clean Build                           ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const outputDir = path.join(__dirname, '..', config.output.directory);

  if (!fs.existsSync(outputDir)) {
    console.log('✅ Output directory does not exist. Nothing to clean.\n');
    return;
  }

  const files = fs.readdirSync(outputDir);

  if (files.length === 0) {
    console.log('✅ Output directory is already empty.\n');
    return;
  }

  console.log(`📂 Output directory: ${outputDir}`);
  console.log(`📋 Files to remove: ${files.length}\n`);

  if (!options.force) {
    console.log('   Files:');
    files.slice(0, 10).forEach(f => console.log(`   - ${f}`));
    if (files.length > 10) {
      console.log(`   ... and ${files.length - 10} more`);
    }
    console.log('\n   Use --force to confirm deletion.\n');
    return;
  }

  console.log('🧹 Cleaning...\n');

  const count = removeDir(outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n✅ Removed ${count} file(s)\n`);
}

main();
