#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dest = path.join(process.cwd(), 'lawson-trailer-hitch.webp');
if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
  console.log('skip decode, existing', fs.statSync(dest).size);
  process.exit(0);
}
const dir = path.join(__dirname, 'hitch-b64');
const parts = fs.readdirSync(dir).filter(function (n) { return /^part\d+\.txt$/.test(n); }).sort();
const b64 = parts.map(function (n) {
  return fs.readFileSync(path.join(dir, n), 'utf8');
}).join('').replace(/\s+/g, '');
const buf = Buffer.from(b64, 'base64');
if (buf.length < 10000) {
  console.error('decode too small', buf.length, '- not writing');
  process.exit(0);
}
fs.writeFileSync(dest, buf);
console.log('decoded', path.basename(dest), fs.statSync(dest).size);
