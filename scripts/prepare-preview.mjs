/**
 * Builds the hosted preview bundle.
 *
 * Differences from `npm run build`:
 *  - relative asset URLs, so it can sit at any path
 *  - the concept banner, so a viewer is never left thinking this is the live
 *    Code Collective site
 *  - no committed snapshot, which the live data path never reads
 *  - any literal U+FFFD in the emitted JavaScript is rewritten to its escape
 *    sequence. `marked` ships one as its invalid-code-point fallback, and some
 *    static hosts reject that byte as corruption. The escape is the identical
 *    character to the JavaScript engine.
 *
 * Usage: npm run build:preview
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'dist-artifact';

/** U+FFFD, and the six-character escape that means the same thing. */
const RAW = String.fromCharCode(0xfffd);
const ESCAPED = String.fromCharCode(92) + 'uFFFD';

fs.rmSync(OUT, { recursive: true, force: true });

execFileSync('npx', ['vite', 'build', '--outDir', OUT], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_BASE: './', VITE_DEMO_NOTE: '1' },
});

fs.rmSync(path.join(OUT, 'snapshot'), { recursive: true, force: true });

let patched = 0;
const assets = path.join(OUT, 'assets');
for (const name of fs.readdirSync(assets)) {
  if (!name.endsWith('.js')) continue;
  const file = path.join(assets, name);
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(RAW)) continue;
  fs.writeFileSync(file, source.split(RAW).join(ESCAPED), 'utf8');
  patched++;
}

// Fail loudly rather than shipping something the host will reject.
for (const name of fs.readdirSync(assets)) {
  if (!/\.(js|css)$/.test(name)) continue;
  const source = fs.readFileSync(path.join(assets, name), 'utf8');
  if (source.includes(RAW)) {
    throw new Error(`${name} still contains a literal U+FFFD`);
  }
}

const files = fs.readdirSync(assets).length + 1;
console.log(`\nprepare-preview: ${files} files in ${OUT}, ${patched} escaped for U+FFFD`);
