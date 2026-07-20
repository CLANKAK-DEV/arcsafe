/**
 * Pre-share / pre-commit secret guard (supports SEC-001).
 *
 * The deployer key lives in .env, which is gitignored — but a plaintext key on
 * disk is still exposed by a folder zip, a backup, or a `git add .` run before
 * the ignore rules are in place. This script fails loudly if the .env key (or
 * any bare 64-hex private key) has leaked into a file that WOULD be shared.
 *
 *   node scripts/check-secrets.js
 *   npm run check:secrets
 *
 * Exit code 1 on any hit, so it can gate a commit hook or CI step. Never prints
 * a full key — matches are redacted.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'artifacts', 'cache', 'coverage',
  '.next', 'out', 'build', 'typechain-types',
]);
// .env itself is meant to hold the key; the point is to catch it ANYWHERE ELSE.
const IGNORE_FILES = new Set(['.env']);

const redact = (hex) => `${hex.slice(0, 6)}****${hex.slice(-4)}`;

function envKey() {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const m = env.match(/^\s*PRIVATE_KEY\s*=\s*(0x[0-9a-fA-F]{64})/m);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (!IGNORE_FILES.has(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

const key = envKey();
const KEY_RE = /(?<![0-9a-fA-F])0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/g;
const hits = [];

for (const file of walk(ROOT)) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue; // binary / unreadable — skip
  }
  const rel = path.relative(ROOT, file);

  // 1. The exact .env key, wherever it turns up, is always a leak.
  if (key && text.toLowerCase().includes(key)) {
    hits.push({ file: rel, why: `contains the .env PRIVATE_KEY (${redact(key)})` });
    continue;
  }

  // 2. A bare 64-hex value assigned to a key-ish name in source/config is
  //    almost certainly a hardcoded secret. Tx hashes in Markdown are not
  //    assignments, so this stays quiet on docs.
  for (const m of text.matchAll(/(?:private[_-]?key|secret|mnemonic)\s*[:=]\s*["']?(0x[0-9a-fA-F]{64})/gi)) {
    hits.push({ file: rel, why: `hardcoded key-like value ${redact(m[1])}` });
  }
}

if (hits.length === 0) {
  console.log('check:secrets — OK. No private key found outside .env.');
  process.exit(0);
}

console.error('check:secrets — POTENTIAL SECRET LEAK:\n');
for (const h of hits) console.error(`  ${h.file}\n    ${h.why}`);
console.error('\nRemove the secret from the file(s) above and rotate the key if it was ever shared.');
process.exit(1);
