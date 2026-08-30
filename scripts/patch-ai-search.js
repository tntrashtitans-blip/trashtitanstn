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
  sameAs: [GBP],
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
  data.sameAs = [GBP];
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
  data.provider.sameAs = [GBP];
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

function patchFile(file) {
  var html = fs.readFileSync(file, 'utf8');
  var orig = html;
  var name = path.basename(file);
  html = patchClassYear(html);

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

var root = process.cwd();
fs.readdirSync(root)
  .filter(function (n) {
    return n.endsWith('.html');
  })
  .forEach(function (name) {
    if (patchFile(path.join(root, name))) console.log('ai-patched', name);
  });
