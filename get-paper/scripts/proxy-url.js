#!/usr/bin/env node
/** Convert an academic site URL/host to its ECNU WebVPN proxy form.
 *  Resolution order: data/proxy-mapping.json (exact host, synced from the
 *  userscript via update-mapping.mjs) → formula fallback ('-'→'--', '.'→'-', HTTPS gets '-443').
 *  Usage: proxy-url.js [--no-443] [--explain] <url-or-host> [...more]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let suffix = '-443';
let explain = false;
const inputs = [];
for (const a of args) {
  if (a === '--no-443') suffix = '';
  else if (a === '--explain') explain = true;
  else inputs.push(a);
}
if (!inputs.length) {
  console.error('usage: proxy-url.js [--no-443] [--explain] <url-or-host> [...]');
  process.exit(2);
}

// load mapping table (skillDir/data/proxy-mapping.json), tolerant if missing
const MAPPING_FILE = path.join(__dirname, '..', 'data', 'proxy-mapping.json');
let mapping = {};
try { mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')).mapping || {}; } catch {}

const PROXY_DOMAIN = 'proxy.ecnu.edu.cn';
for (const input of inputs) {
  let host, urlPath = '', query = '';
  const m = input.match(/^(?:https?:\/\/)?([^/?#]+)([^?#]*)(\?.*)?$/);
  if (!m) { console.error(`cannot parse: ${input}`); process.exit(2); }
  host = m[1]; urlPath = m[2] || '/'; query = m[3] || '';
  host = host.replace(/^[^@]+@/, '').replace(/:\d+$/, '');

  let prefix, via;
  if (mapping[host]) {
    prefix = mapping[host];
    via = 'mapping';
  } else {
    prefix = host.replace(/-/g, '--').replace(/\./g, '-') + suffix;
    via = 'formula';
  }
  if (explain) console.error(`${host}: via ${via}`);
  console.log(`https://${prefix}.${PROXY_DOMAIN}${urlPath}${query}`);
}
