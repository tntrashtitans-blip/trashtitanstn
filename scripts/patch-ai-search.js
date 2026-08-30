#!/usr/bin/env node
/**
 * Build-time AI-search entity patch. Idempotent.
 * Unifies LocalBusiness name, links Google listing, names Lawson as founder,
 * drops copied 37129 zips and FAQPage schema (HTML FAQs stay).
 */
const fs = require('fs');
const path = require('path');

const GBP =
  'https://www.google.com/maps/place/Trash+Titans/@35.9277969,-86.2991721,17z/data=!4m6!3m5!1s0x65543b4ffe424819:0xf04d58c0cd2ab83d!16s%2Fg%2F11z304_ydp';
const INSTAGRAM = 'https://www.instagram.com/trash_titans_junk_removal/';
const FACEBOOK = 'https://www.facebook.com/trash.titans.34016';
const SAME_AS = [GBP, INSTAGRAM, FACEBOOK];
const BIZ_ID = 'https://tntrashtitans.com/#localbusiness';
const PERSON_ID = 'https://tntrashtitans.com/teen-entrepreneur#person';

const CITIES = [
  'Murfreesboro',
  'Nashville',
  'Smyrna',
  'LaVergne',
  'Nolensville',
  'Franklin',
  'Lebanon',
  'Mt. Juliet',
];

const FOUNDER = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Lawson Gregory',
  jobTitle: 'Owner',
  url: 'https://tntrashtitans.com/teen-entrepreneur',
};

const HOME_LD = {
  '@context': 'https://schema.org',
  '@type': ['HomeAndConstructionBusiness', 'LocalBusiness'],
  '@id': BIZ_ID,
  name: 'Trash Titans',
  alternateName: 'Trash Titans Junk Removal',
  legalName: 'Trash Titans',
  description:
    'Junk removal in Murfreesboro, Nashville, and Middle Tennessee. Owner-operated by Lawson Gregory. Call or text 615-987-9876.',
  url: 'https://tntrashtitans.com',
  telephone: '+16159879876',
  email: 'TNTrashTitans@gmail.com',
  priceRange: '$$',
  image: 'https://tntrashtitans.com/trash-titans-truck-murfreesboro-tn.webp',
  logo: 'https://tntrashtitans.com/trash-titans-logo.webp',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Murfreesboro',
    addressRegion: 'TN',
    addressCountry: 'US',
  },
  areaServed: CITIES.map(function (name) {
    return { '@type': 'City', name: name };
  }),
  founder: FOUNDER,
  sameAs: SAME_AS,
  knowsAbout: [
    'junk removal',
    'garage cleanout',
    'furniture removal',
    'appliance removal',
    'storm debris cleanup',
    'estate cleanout',
    'commercial cleanout',
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Junk removal services',
    itemListElement: [
      'Junk removal',
      'Garage cleanout',
      'Furniture removal',
      'Appliance removal',
      'Renovation and construction debris removal',
      'Storm debris cleanup',
      'Commercial cleanout',
      'Estate cleanout',
      'Curbside junk pickup',
      'Yard debris removal',
    ].map(function (name) {
      return { '@type': 'Offer', itemOffered: { '@type': 'Service', name: name } };
    }),
  },
};

const PERSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Lawson Gregory',
  jobTitle: 'Owner',
  url: 'https://tntrashtitans.com/teen-entrepreneur',
  image: 'https://tntrashtitans.com/lawson-gregory-trash-titans-owner.webp',
  worksFor: { '@id': BIZ_ID },
  alumniOf: {
    '@type': 'EducationalOrganization',
    name: 'Oakland High School',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Murfreesboro',
      addressRegion: 'TN',
      addressCountry: 'US',
    },
  },
};

function scriptTag(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>';
}

function eachLd(html, fn) {
  return html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    function (full, raw) {
      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return full;
      }
      var next = fn(data, full);
      if (next === null) return '';
      if (next === full || next === undefined) return full;
      if (typeof next === 'string') return next;
      return scriptTag(next);
    }
  );
}

function patchHome(html) {
  var replaced = false;
  html = eachLd(html, function (data) {
    var type = data['@type'];
    var isHome =
      type === 'HomeAndConstructionBusiness' ||
      (Array.isArray(type) && type.indexOf('HomeAndConstructionBusiness') !== -1);
    if (!isHome) return data;
    replaced = true;
    return HOME_LD;
  });
  if (!replaced && html.indexOf('<title>Trash Titans') !== -1) {
    html = html.replace('</head>', scriptTag(HOME_LD) + '\n</head>');
  }
  return html;
}

function patchLocalBusiness(data) {
  if (data['@type'] !== 'LocalBusiness') return data;
  data['@id'] = BIZ_ID;
  data.name = 'Trash Titans';
  data.sameAs = SAME_AS;
  data.founder = FOUNDER;
  if (!data.logo) data.logo = 'https://tntrashtitans.com/trash-titans-logo.webp';
  if (!data.image) data.image = 'https://tntrashtitans.com/trash-titans-truck-murfreesboro-tn.webp';
  if (data.address && typeof data.address === 'object') {
    delete data.address.postalCode;
  }
  delete data.aggregateRating;
  return data;
}

function patchProvider(data) {
  if (!data.provider || typeof data.provider !== 'object') return data;
  data.provider['@id'] = BIZ_ID;
  data.provider.name = 'Trash Titans';
  data.provider.sameAs = SAME_AS;
  return data;
}

function patchClassYear(html) {
  html = html.replace(/is a junior at Oakland High School/g, 'is a senior at Oakland High School');
  html = html.replace(/a junior at Oakland High School/g, 'a senior at Oakland High School');
  if (html.indexOf('starting as a junior at sixteen years old') === -1) {
    html = html.replace(/starting at sixteen years old/g, 'starting as a junior at sixteen years old');
  }
  if (html.indexOf('I started Trash Titans as a junior in March 2025') === -1) {
    html = html.replace(/I started Trash Titans in March 2025/g, 'I started Trash Titans as a junior in March 2025');
  }
  return html;
}

function patchFooter(html) {
  html = html.replace(/<p class="footer-social"[^>]*>[\s\S]*?<\/p>\s*/g, '');
  var igSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#3a9e3a" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>';
  var fbSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#3a9e3a" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>';
  var linkStyle =
    'display:inline-flex;align-items:center;gap:0.4rem;color:#3a9e3a;text-decoration:none;font-size:0.85rem;';
  var block =
    '<p class="footer-social" style="margin:0.55rem 0 1.1rem;display:flex;justify-content:center;align-items:center;gap:1.25rem;flex-wrap:wrap;">' +
    '<a href="' + INSTAGRAM + '" target="_blank" rel="noopener noreferrer" aria-label="Trash Titans on Instagram" style="' + linkStyle + '">' +
    igSvg +
    'Instagram</a>' +
    '<a href="' + FACEBOOK + '" target="_blank" rel="noopener noreferrer" aria-label="Trash Titans on Facebook" style="' + linkStyle + '">' +
    fbSvg +
    'Facebook</a>' +
    '</p>\n';
  if (/<div class="footer-tagline">[\s\S]*?<\/div>/.test(html)) {
    return html.replace(/(<div class="footer-tagline">[\s\S]*?<\/div>)/, '$1\n' + block);
  }
  if (/<div class="footer-logo">[\s\S]*?<\/div>/.test(html)) {
    return html.replace(/(<div class="footer-logo">[\s\S]*?<\/div>)/, '$1\n' + block);
  }
  var i = html.lastIndexOf('</footer>');
  if (i === -1) return html;
  return html.slice(0, i) + block + html.slice(i);
}


var BLOG_CARD_FILES = {
  'index.html': true,
  'murfreesboro.html': true,
  'nashville.html': true,
  'smyrna.html': true,
  'lavergne.html': true,
  'nolensville.html': true,
  'franklin.html': true,
  'lebanon.html': true,
  'mt-juliet.html': true,
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadBlogs() {
  try {
    var raw = fs.readFileSync(path.join(process.cwd(), 'blogs.json'), 'utf8');
    var data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function resolveLabelColor(c) {
  if (!c) return '#c8a84b';
  if (String(c).indexOf('var(') !== -1) return '#3a9e3a';
  return c;
}

function buildBlogCard(post) {
  var href = '/' + String(post.slug || '').replace(/^\/+/, '');
  var img = post.image || '/before-junk-removal-middle-tennessee.webp';
  var alt = escapeHtml(post.imageAlt || post.title || '');
  var pos = escapeHtml(post.imagePosition || 'center');
  var color = resolveLabelColor(post.labelColor);
  var title = escapeHtml(post.title || '');
  var cat = escapeHtml(post.category || '');
  var cta = escapeHtml(post.cta || 'Read more');
  return (
    '<a href="' + escapeHtml(href) + '" style="text-decoration:none;color:inherit;">' +
      '<div style="background:#1a1a1a;border-radius:10px;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform=\'translateY(-4px)\';this.style.boxShadow=\'0 12px 40px rgba(0,0,0,0.5)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'none\'">' +
        '<img src="' + escapeHtml(img) + '" alt="' + alt + '" style="width:100%;height:180px;object-fit:cover;object-position:' + pos + ';display:block;">' +
        '<div style="padding:1.2rem;">' +
          '<div style="font-size:0.65rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:' + escapeHtml(color) + ';margin-bottom:0.4rem;">' + cat + '</div>' +
          '<h3 style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#fff;line-height:1.1;margin-bottom:0.5rem;">' + title + '</h3>' +
          '<span style="color:#c8a84b;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">' + cta + ' &rarr;</span>' +
        '</div>' +
      '</div>' +
    '</a>'
  );
}

function buildBlogCardsSection(posts, opts) {
  opts = opts || {};
  var list = posts.slice(0, opts.limit || 4);
  var cards = list.map(buildBlogCard).join('\n');
  var idAttr = opts.id ? ' id="' + opts.id + '"' : '';
  return (
    '<section' + idAttr + ' class="blog-cards-smyrna" style="background:#111;padding:4rem 1rem;">\n' +
    '  <div style="max-width:1100px;margin:0 auto;">\n' +
    '    <div style="text-align:center;margin-bottom:2.5rem;">\n' +
    '      <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c8a84b;margin-bottom:0.5rem;">From The Blog</div>\n' +
    '      <h2 style="font-family:\'Bebas Neue\',sans-serif;font-size:2.8rem;color:#fff;letter-spacing:0.05em;">Stories &amp; Tips</h2>\n' +
    '      <p style="color:#aaa;font-size:0.95rem;max-width:500px;margin:0.5rem auto 0;">Real stories from the road and local insights from Middle Tennessee\'s hardest-working junk removal crew.</p>\n' +
    '    </div>\n' +
    '    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.5rem;">\n' +
    cards + '\n' +
    '    </div>\n' +
    '    <div style="text-align:center;margin-top:2.5rem;">\n' +
    '      <a href="/blog" style="color:#c8a84b;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:0.9rem;text-decoration:none;">See all stories &rarr;</a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</section>'
  );
}

function patchBlogCards(html, name) {
  if (name === 'blog.html' || name === 'trailer-maintenance.html') return html;
  if (!BLOG_CARD_FILES[name]) return html;
  var posts = loadBlogs();
  if (!posts.length) return html;
  var section = buildBlogCardsSection(posts, {
    limit: 4,
    id: name === 'index.html' ? 'blog' : undefined,
  });
  var smyrnaRe = /<section\b[^>]*\bclass="[^"]*\bblog-cards-smyrna\b[^"]*"[^>]*>[\s\S]*?<\/section>/i;
  if (smyrnaRe.test(html)) return html.replace(smyrnaRe, section);
  if (name === 'index.html') {
    var homeRe = /<section\b[^>]*\bid=["']blog["'][^>]*>[\s\S]*?<\/section>/i;
    if (homeRe.test(html)) return html.replace(homeRe, section);
  }
  var cityRe = /<section\b[^>]*>[\s\S]*?From The Blog[\s\S]*?<\/section>/i;
  if (cityRe.test(html)) return html.replace(cityRe, section);
  return html;
}

function patchFile(file) {
  var html = fs.readFileSync(file, 'utf8');
  var orig = html;
  var name = path.basename(file);
  html = patchClassYear(html);
  html = patchFooter(html);
  html = patchBlogCards(html, name);

  html = html.replace(
    /<script type="application\/ld\+json">\s*\{[^{}]*"@type"\s*:\s*"FAQPage"[\s\S]*?<\/script>/g,
    ''
  );

  if (name === 'index.html') {
    html = patchHome(html);
  } else if (name === 'teen-entrepreneur.html') {
    html = eachLd(html, function (data) {
      if (data['@type'] === 'BlogPosting') {
        data.dateModified = '2026-08-29';
        data.author = {
          '@type': 'Person',
          '@id': PERSON_ID,
          name: 'Lawson Gregory',
          url: 'https://tntrashtitans.com/teen-entrepreneur',
        };
      }
      return data;
    });
    if (html.indexOf('"alumniOf"') === -1) {
      html = html.replace('</head>', scriptTag(PERSON_LD) + '\n</head>');
    }
  } else {
    html = eachLd(html, function (data) {
      if (data['@type'] === 'FAQPage') return null;
      if (data['@type'] === 'LocalBusiness') return patchLocalBusiness(data);
      if (data['@type'] === 'Service') return patchProvider(data);
      delete data.aggregateRating;
      return data;
    });
  }

  if (html !== orig) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

if (require.main === module) {
  var root = process.cwd();
  fs.readdirSync(root)
    .filter(function (n) {
      return n.endsWith('.html');
    })
    .forEach(function (name) {
      if (patchFile(path.join(root, name))) console.log('ai-patched', name);
    });
}

module.exports = {
  patchBlogCards: patchBlogCards,
  buildBlogCardsSection: buildBlogCardsSection,
  loadBlogs: loadBlogs,
};
