#!/usr/bin/env node
/**
 * Build-time patch for live Google review stats + reviews-panel CTAs.
 * Idempotent. Never writes 7, 5.0, 32, or 4.9 as published stats.
 */
const fs = require('fs');
const path = require('path');

const REVIEWS_URL =
  'https://www.google.com/maps/place/Trash+Titans/@35.9277969,-86.2991721,17z/data=!4m6!3m5!1s0x65543b4ffe424819:0xf04d58c0cd2ab83d!16s%2Fg%2F11z304_ydp#lrd=0x65543b4ffe424819:0xf04d58c0cd2ab83d,1';

const CITY_CHIP =
  '<a href="' + REVIEWS_URL + '" target="_blank" rel="noopener" data-google-reviews-link style="font-size:0.8rem;color:#aaa;text-decoration:none;"><span data-google-live hidden>&#11088; <span data-google-rating></span> Google Rating</span><span data-google-fallback>&#11088; Google reviews</span></a>';

const OLD_STATS =
  '<div style="text-align:center;flex-shrink:0;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:2.8rem;color:#fbbc04;line-height:1;">5.0</div><div style="color:#fbbc04;font-size:0.9rem;letter-spacing:1px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div><div style="font-size:0.68rem;color:rgba(255,255,255,0.45);margin-top:0.2rem;text-transform:uppercase;letter-spacing:0.05em;">7 Google Reviews</div></div>';

const NEW_STATS =
  '<div style="text-align:center;flex-shrink:0;"><div data-google-live data-google-stat hidden><div style="font-family:\'Bebas Neue\',sans-serif;font-size:2.8rem;color:#fbbc04;line-height:1;" data-google-rating></div><div style="color:#fbbc04;font-size:0.9rem;letter-spacing:1px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div><div style="font-size:0.68rem;color:rgba(255,255,255,0.45);margin-top:0.2rem;text-transform:uppercase;letter-spacing:0.05em;"><span data-google-count></span> Google Reviews</div></div><div data-google-fallback><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.45rem;color:#fbbc04;line-height:1.1;">Google reviews</div><div style="color:#fbbc04;font-size:0.9rem;letter-spacing:1px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div></div></div>';

function stripStaleRating(html) {
  return html.replace(
    /,\s*"aggregateRating"\s*:\s*\{\s*"@type"\s*:\s*"AggregateRating"[^}]*"reviewCount"\s*:\s*"7"\s*\}/g,
    ''
  );
}

function ensureHiddenCss(html) {
  if (html.indexOf('[hidden]{display:none!important;}') !== -1) return html;
  if (html.indexOf('<style>') !== -1) {
    return html.replace('<style>', '<style>[hidden]{display:none!important;}');
  }
  return html.replace('</head>', '<style>[hidden]{display:none!important;}</style>\n</head>');
}

function ensureScript(html) {
  if (html.indexOf('/js/google-reviews.js') !== -1) return html;
  return html.replace('</body>', '<script src="/js/google-reviews.js" defer></script>\n</body>');
}

function rewriteReviewLinks(html) {
  html = html.replace(
    /https:\/\/www\.google\.com\/maps\/place\/Trash\+Titans\/[^"'>\s]*/g,
    REVIEWS_URL
  );
  html = html.replace(
    /<a ([^>]*?)>(\s*(?:&#11088;\s*)?Read Our Reviews\s*)<\/a>/gi,
    function (_, attrs, label) {
      var a = attrs;
      if (!/\btarget=/.test(a)) a += ' target="_blank"';
      if (!/\brel=/.test(a)) a += ' rel="noopener"';
      if (!/data-google-reviews-link/.test(a)) a += ' data-google-reviews-link';
      if (/href=/.test(a)) {
        a = a.replace(/href="[^"]*"/, 'href="' + REVIEWS_URL + '"');
        a = a.replace(/href='[^']*'/, "href='" + REVIEWS_URL + "'");
      } else {
        a += ' href="' + REVIEWS_URL + '"';
      }
      return '<a ' + a + '>' + label + '</a>';
    }
  );
  return html;
}

function patchHomepage(html) {
  html = html.replace('id="google-reviews"', 'id="reviews"');
  html = html.replace(
    '<h2 class="section-title">5.0 Stars on Google</h2>',
    '<h2 class="section-title"><span data-google-live hidden><span data-google-rating></span> Stars on Google</span><span data-google-fallback>Google Reviews</span></h2>'
  );
  html = html.replace(
    '7 verified Google reviews from real Middle Tennessee customers.',
    '<span data-google-live hidden><span data-google-count></span> verified Google reviews from real Middle Tennessee customers.</span><span data-google-fallback>Google reviews from real Middle Tennessee customers.</span>'
  );
  if (html.indexOf(OLD_STATS) !== -1) html = html.replace(OLD_STATS, NEW_STATS);
  html = html.replace(
    'Every Trash Titans review is from a real Middle Tennessee customer. <strong style="color:#fbbc04;">5.0 stars</strong> across 7 Google reviews.',
    'Every Trash Titans review is from a real Middle Tennessee customer. <span data-google-live hidden><strong style="color:#fbbc04;"><span data-google-rating></span> stars</strong> across <span data-google-count></span> Google reviews.</span> <a href="' +
      REVIEWS_URL +
      '" target="_blank" rel="noopener" data-google-reviews-link style="color:#fbbc04;font-weight:700;">Read them on Google.</a>'
  );
  if (html.indexOf('href="/css/site.css"') === -1) {
    html = html.replace(/<style>:root\{--black:#0d0d0d;[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/css/site.css">');
  }
  return html;
}

function patchCity(html) {
  return html.replace(
    '<span style="font-size:0.8rem;color:#aaa;">&#11088; 5.0 Google Rating</span>',
    CITY_CHIP
  );
}

function patchFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;
  html = stripStaleRating(html);
  html = ensureHiddenCss(html);
  html = patchHomepage(html);
  html = patchCity(html);
  html = rewriteReviewLinks(html);
  html = ensureScript(html);
  if (html !== orig) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

const root = process.cwd();
fs.readdirSync(root)
  .filter(function (n) { return n.endsWith('.html'); })
  .forEach(function (name) {
    if (patchFile(path.join(root, name))) console.log('patched', name);
  });
