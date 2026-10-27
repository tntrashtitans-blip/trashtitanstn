#!/usr/bin/env node
/**
 * Submit sitemap URLs to IndexNow.
 *
 *   node scripts/indexnow.js
 *   node scripts/indexnow.js --dry-run
 *
 * Reads the 32-hex key file at the site root and every <loc> in sitemap.xml,
 * then POSTs them to https://api.indexnow.org/indexnow.
 */
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const HOST = 'tntrashtitans.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const ROOT = path.join(__dirname, '..');
const MAX_URLS = 10000;
const RETRY_DELAYS_MS = [5000, 15000];

function findKey(root) {
  const names = fs.readdirSync(root).filter(function (name) {
    return /^[a-f0-9]{32}\.txt$/.test(name);
  });
  if (names.length !== 1) {
    throw new Error(
      'Expected exactly one 32-hex IndexNow key file (*.txt) at the site root, found ' +
        names.length +
        (names.length ? ': ' + names.join(', ') : '')
    );
  }
  const key = names[0].slice(0, -4);
  const raw = fs.readFileSync(path.join(root, names[0]), 'utf8').replace(/^\uFEFF/, '');
  if (raw !== key && raw !== key + '\n' && raw !== key + '\r\n') {
    throw new Error('IndexNow key file ' + names[0] + ' must contain only the key');
  }
  return key;
}

function readSitemapUrls(root, host) {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const urls = [];
  const seen = Object.create(null);
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = re.exec(xml))) {
    const url = match[1];
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      throw new Error('Sitemap has an invalid URL: ' + url);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Sitemap URL is not http(s): ' + url);
    }
    if (parsed.hostname !== host) {
      throw new Error('Sitemap URL is not on ' + host + ': ' + url);
    }
    if (!seen[url]) {
      seen[url] = true;
      urls.push(url);
    }
  }
  if (!urls.length) {
    throw new Error('No URLs found in sitemap.xml');
  }
  return urls;
}

function postJson(url, payload) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  return new Promise(function (resolve, reject) {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': data.length,
        },
      },
      function (res) {
        const chunks = [];
        res.on('data', function (chunk) {
          chunks.push(chunk);
        });
        res.on('end', function () {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function submitBatch(payload, retry) {
  const delays = retry ? RETRY_DELAYS_MS : [];
  let last;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) {
      console.log(
        'IndexNow HTTP ' + last.status + '; retrying in ' + delays[attempt - 1] / 1000 + 's'
      );
      await sleep(delays[attempt - 1]);
    }
    last = await postJson(ENDPOINT, payload);
    if (last.status !== 403 && last.status !== 429) break;
  }
  return last;
}

async function notifyIndexNow(options) {
  const opts = options || {};
  const root = opts.root || ROOT;
  const key = findKey(root);
  const urls = readSitemapUrls(root, HOST);
  const keyLocation = 'https://' + HOST + '/' + key + '.txt';

  if (opts.dryRun) {
    return {
      dryRun: true,
      host: HOST,
      keyLocation: keyLocation,
      count: urls.length,
      urls: urls,
      status: 0,
      body: '',
    };
  }

  let last = { status: 0, body: '' };
  for (let i = 0; i < urls.length; i += MAX_URLS) {
    const payload = {
      host: HOST,
      key: key,
      keyLocation: keyLocation,
      urlList: urls.slice(i, i + MAX_URLS),
    };
    last = await submitBatch(payload, !!opts.retry);
    if (last.status !== 200 && last.status !== 202) {
      let detail = last.body ? ' ' + last.body.trim() : '';
      if (last.status === 403) {
        detail +=
          ' The key file must be publicly reachable and contain only the key before IndexNow will accept URLs.';
      }
      const err = new Error('IndexNow returned HTTP ' + last.status + ' for ' + keyLocation + '.' + detail);
      err.status = last.status;
      err.body = last.body;
      err.keyLocation = keyLocation;
      err.count = urls.length;
      throw err;
    }
  }

  return {
    dryRun: false,
    host: HOST,
    keyLocation: keyLocation,
    count: urls.length,
    status: last.status,
    body: last.body,
  };
}

function printResult(result) {
  if (result.dryRun) {
    console.log(
      'Dry run: would POST ' +
        result.count +
        ' URL(s) to ' +
        ENDPOINT +
        ' for host ' +
        result.host +
        ' with keyLocation ' +
        result.keyLocation
    );
    return;
  }
  console.log(
    'Submitted ' +
      result.count +
      ' URL(s) to IndexNow (HTTP ' +
      result.status +
      '). Key file: ' +
      result.keyLocation
  );
}

if (require.main === module) {
  const dryRun = process.argv.indexOf('--dry-run') !== -1;
  notifyIndexNow({ dryRun: dryRun })
    .then(function (result) {
      printResult(result);
    })
    .catch(function (err) {
      console.error(err.message || err);
      process.exitCode = 1;
    });
}

module.exports = {
  notifyIndexNow,
  findKey,
  readSitemapUrls,
  HOST,
  ENDPOINT,
};
