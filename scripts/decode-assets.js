#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'hitch-b64');
const parts = fs.readdirSync(dir).filter(function (n) { return /^part\d+\.txt$/.test(n); }).sort();
const b64 = parts.map(function (n) {
  return fs.readFileSync(path.join(dir, n), 'utf8');
}).join('').replace(/\s+/g, '');
const dest = path.join(process.cwd(), 'lawson-trailer-hitch.webp');
fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
console.log('decoded', path.basename(dest), fs.statSync(dest).size);
