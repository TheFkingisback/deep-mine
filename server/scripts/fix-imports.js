/**
 * Post-build script: rewrites @shared/* imports to relative paths
 * pointing to ../../packages/shared/dist/*.js
 *
 * Run after tsc: node scripts/fix-imports.js
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const SHARED_DIST = join(__dirname, '..', '..', 'packages', 'shared', 'dist');

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
  let totalReplacements = 0;

  for (const file of files) {
    let content = await readFile(file, 'utf-8');
    const originalContent = content;

    // Replace: from '@shared/xyz' → from '../../packages/shared/dist/xyz.js'
    // Also handles: from "@shared/xyz"
    content = content.replace(
      /from\s+['"]@shared\/([^'"]+)['"]/g,
      (match, moduleName) => {
        const relPath = relative(dirname(file), SHARED_DIST).replace(/\\/g, '/');
        return `from '${relPath}/${moduleName}.js'`;
      }
    );

    if (content !== originalContent) {
      await writeFile(file, content, 'utf-8');
      const count = (content.match(/packages\/shared\/dist/g) || []).length;
      totalReplacements += count;
      console.log(`  ✓ ${relative(DIST_DIR, file)} (${count} imports fixed)`);
    }
  }

  console.log(`\nDone: ${totalReplacements} imports fixed across ${files.length} files.`);
}

main().catch((err) => {
  console.error('Fix-imports failed:', err);
  process.exit(1);
});
