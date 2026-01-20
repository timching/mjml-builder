#!/usr/bin/env node

/**
 * MJML Binary CLI
 * Standalone MJML compiler - converts MJML markup to responsive HTML
 */

const { program } = require('commander');
const mjml = require('mjml');
const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');

program
  .name('mjml')
  .description('MJML to HTML compiler - Standalone binary')
  .version(packageJson.version)
  .argument('[input]', 'Input MJML file (reads from stdin if not provided)')
  .option('-o, --output <file>', 'Output file (prints to stdout if not provided)')
  .option('-c, --config <file>', 'Path to MJML config file')
  .option('--validation-level <level>', 'Validation level: strict, soft, skip', 'soft')
  .option('--minify', 'Minify the output HTML', false)
  .option('--beautify', 'Beautify the output HTML', false)
  .option('--no-minify-options', 'Disable default minification options')
  .option('-w, --watch', 'Watch for file changes and recompile')
  .option('--stdin', 'Force reading from stdin')
  .option('--stdout', 'Force writing to stdout')
  .option('-s, --silent', 'Suppress console output except errors')
  .option('--filePath <path>', 'Path for mj-include resolution')
  .option('--juicePreserveTags', 'Preserve style tags when inlining CSS')
  .option('--fonts <json>', 'Custom fonts as JSON object')
  .action(async (input, options) => {
    try {
      let mjmlContent;

      // Read input
      if (options.stdin || !input) {
        mjmlContent = await readStdin();
      } else {
        const inputPath = path.resolve(input);
        if (!fs.existsSync(inputPath)) {
          console.error(`Error: Input file not found: ${inputPath}`);
          process.exit(1);
        }
        mjmlContent = fs.readFileSync(inputPath, 'utf8');
      }

      // Load config if provided
      let mjmlConfig = {};
      if (options.config) {
        const configPath = path.resolve(options.config);
        if (fs.existsSync(configPath)) {
          mjmlConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      }

      // Build MJML options
      const mjmlOptions = {
        validationLevel: options.validationLevel,
        minify: options.minify,
        beautify: options.beautify,
        filePath: options.filePath || (input ? path.resolve(input) : undefined),
        ...mjmlConfig
      };

      // Parse custom fonts
      if (options.fonts) {
        try {
          mjmlOptions.fonts = JSON.parse(options.fonts);
        } catch (e) {
          console.error('Error: Invalid JSON for --fonts option');
          process.exit(1);
        }
      }

      // Compile MJML
      const result = mjml(mjmlContent, mjmlOptions);

      // Handle validation errors
      if (result.errors && result.errors.length > 0) {
        if (!options.silent) {
          result.errors.forEach(error => {
            const level = error.severity === 'error' ? 'Error' : 'Warning';
            console.error(`${level}: ${error.message} (line ${error.line})`);
          });
        }

        if (options.validationLevel === 'strict' &&
            result.errors.some(e => e.severity === 'error')) {
          process.exit(1);
        }
      }

      // Write output
      if (options.stdout || !options.output) {
        process.stdout.write(result.html);
      } else {
        const outputPath = path.resolve(options.output);
        const outputDir = path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, result.html);

        if (!options.silent) {
          console.error(`Compiled: ${options.output}`);
        }
      }

      // Watch mode
      if (options.watch && input) {
        if (!options.silent) {
          console.error(`Watching for changes: ${input}`);
        }

        const inputPath = path.resolve(input);
        let debounceTimer;

        fs.watch(inputPath, (eventType) => {
          if (eventType === 'change') {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              try {
                const content = fs.readFileSync(inputPath, 'utf8');
                const watchResult = mjml(content, mjmlOptions);

                if (options.output) {
                  fs.writeFileSync(path.resolve(options.output), watchResult.html);
                  if (!options.silent) {
                    console.error(`Recompiled: ${options.output}`);
                  }
                } else {
                  process.stdout.write(watchResult.html);
                }
              } catch (e) {
                console.error(`Compilation error: ${e.message}`);
              }
            }, 100);
          }
        });
      }

    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Read content from stdin
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);

    // Timeout after 5 seconds if no input
    setTimeout(() => {
      if (!data) {
        reject(new Error('No input received from stdin'));
      }
    }, 5000);
  });
}

program.parse();
