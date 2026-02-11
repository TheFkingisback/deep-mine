/**
 * Post-build script: adds .js extensions to relative imports for ESM compatibility.
 * Run after tsc: node scripts/fix-extensions.js
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');

async function getAllJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await getAllJsFiles(DIST_DIR);
  let totalFixed = 0;

  for (const file of files) {
    let content = await readFile(file, 'utf-8');
    const original = content;

    // Add .js to relative imports/exports that don't already have an extension
    // Matches: from './foo'  or  from '../bar'  (but not from './foo.js')
    content = content.replace(
      /(from\s+['"])(\.\.?\/[^'"]+?)(?<!\.js)(['"])/g,
      '$1$2.js$3'
    );

    // Also handle: export * from './foo'
    // (already covered by the regex above since it matches `from '...'`)

    if (content !== original) {
      await writeFile(file, content, 'utf-8');
      totalFixed++;
      console.log(`  ✓ ${relative(DIST_DIR, file)}`);
    }
  }

  console.log(`\nDone: ${totalFixed} files fixed.`);
}

main().catch((err) => {
  console.error('Fix-extensions failed:', err);
  process.exit(1);
});
