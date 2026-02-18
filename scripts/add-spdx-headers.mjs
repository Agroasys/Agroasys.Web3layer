#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

const roots = process.argv.slice(2);
const targetRoots = roots.length > 0 ? roots : ['contracts', 'sdk'];

const skipDirNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'artifacts',
  'cache',
  'coverage',
  'typechain',
  'typechain-types',
  'lib',
  'out',
  '.next',
]);

const jsTsExtensions = new Set(['.js', '.ts', '.tsx']);

const jsTsHeader = '/**\n * SPDX-License-Identifier: Apache-2.0\n */\n';
const solHeader = '// SPDX-License-Identifier: Apache-2.0\n';
const spdxRegex = /SPDX-License-Identifier:/;

let changed = 0;
let skipped = 0;
let scanned = 0;

async function walk(currentPath) {
  const stats = await fs.stat(currentPath);
  if (stats.isDirectory()) {
    const dirName = path.basename(currentPath);
    if (skipDirNames.has(dirName)) {
      return;
    }

    const entries = await fs.readdir(currentPath);
    for (const entry of entries) {
      await walk(path.join(currentPath, entry));
    }
    return;
  }

  await processFile(currentPath);
}

async function processFile(filePath) {
  const ext = path.extname(filePath);
  const isSolidity = ext === '.sol';
  const isJsTs = jsTsExtensions.has(ext);

  if (!isSolidity && !isJsTs) {
    return;
  }

  scanned += 1;
  const original = await fs.readFile(filePath, 'utf8');

  if (spdxRegex.test(original)) {
    skipped += 1;
    return;
  }

  let updated;
  if (isSolidity) {
    updated = `${solHeader}${original}`;
  } else {
    if (original.startsWith('#!')) {
      const newlineIndex = original.indexOf('\n');
      if (newlineIndex === -1) {
        updated = `${original}\n${jsTsHeader}`;
      } else {
        const shebang = original.slice(0, newlineIndex + 1);
        const remainder = original.slice(newlineIndex + 1);
        updated = `${shebang}${jsTsHeader}${remainder}`;
      }
    } else {
      updated = `${jsTsHeader}${original}`;
    }
  }

  if (updated !== original) {
    await fs.writeFile(filePath, updated, 'utf8');
    changed += 1;
  }
}

async function main() {
  for (const root of targetRoots) {
    await walk(root);
  }

  console.log(`SPDX scan complete: scanned=${scanned} changed=${changed} skipped=${skipped}`);
}

main().catch((error) => {
  console.error('Failed to add SPDX headers:', error);
  process.exit(1);
});
