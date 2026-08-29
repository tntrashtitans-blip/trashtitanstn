/**
 * Live Google Place rating + review count for Trash Titans.
 * Prefers Places API (New) Place Details when GOOGLE_PLACES_API_KEY is set.
 * Cached in-memory for 1 hour. Returns { ok:false } instead of stale numbers.
 */
const FEATURE_ID = '0x65543b4ffe424819:0xf04d58c0cd2ab83d';
const CID = '17315593727408519229';
const LAT = 35.9277969;
const LNG = -86.2991721;
const PLACE_NAME = 'Trash Titans';
const REVIEWS_URL =
  'https://www.google.com/maps/place/Trash+Titans/@35.9277969,-86.2991721,17z/data=!4m6!3m5!1s0x65543b4ffe424819:0xf04d58c0cd2ab83d!16s%2Fg%2F11z304_ydp#lrd=0x65543b4ffe424819:0xf04d58c0cd2ab83d,1';
const CACHE_MS = 60 * 60 * 1000;

let cache = { expires: 0, body: null };

function okPayload(rating, userRatingCount) {
  const r = Number(rating);
  const n = Number(userRatingCount);
  if (!Number.isFinite(r) || r <= 0 || r > 5) return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  return {
    ok: true,
    rating: r,
    userRatingCount: Math.round(n),
    reviewsUrl: REVIEWS_URL
  };
}

function json(status, body) {
  const cached = status === 200 && body && body.ok;
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cached ? 'public, max-age=3600' : 'no-store',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}

async function placeDetails(apiKey, placeId) {
  if (!placeId) return null;
  const id = String(placeId).replace(/^places\//, '');
  const url = 'https://places.googleapis.com/v1/places/' + encodeURIComponent(id);
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount'
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return okPayload(data.rating, data.userRatingCount);
}

async function resolvePlaceId(apiKey) {
  const fromEnv = process.env.GOOGLE_PLACE_ID;
  if (fromEnv) return fromEnv;

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName'
    },
    body: JSON.stringify({
      textQuery: PLACE_NAME,
      locationBias: {
        circle: {
          center: { latitude: LAT, longitude: LNG },
          radius: 500
        }
      },
      maxResultCount: 5
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const places = Array.isArray(data.places) ? data.places : [];
  const named = places.find(function (p) {
    const name = p && p.displayName && p.displayName.text;
    return name && /trash\s*titans/i.test(name);
  });
  const pick = named || places[0];
  return pick && pick.id ? pick.id : null;
}

async function fromPlacesApi(apiKey) {
  try {
    const directIds = [process.env.GOOGLE_PLACE_ID, FEATURE_ID, 'cid:' + CID].filter(Boolean);
    for (const id of directIds) {
      const got = await placeDetails(apiKey, id);
      if (got) return got;
    }
    const resolved = await resolvePlaceId(apiKey);
    if (resolved) return await placeDetails(apiKey, resolved);
  } catch (err) {
    console.error('places api error', err);
  }
  return null;
}

function pickFromJsonLd(html) {
  const scripts = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
  for (const block of scripts) {
    const raw = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : [data];
      if (data && data['@graph']) nodes.push.apply(nodes, data['@graph']);
      for (const node of nodes) {
        const agg = node && node.aggregateRating;
        if (agg) {
          const got = okPayload(agg.ratingValue, agg.reviewCount || agg.ratingCount);
          if (got) return got;
        }
      }
    } catch (e) {
      /* ignore malformed ld+json */
    }
  }
  return null;
}

async function fromPublicLookup() {
  const urls = [
    'https://www.google.com/maps?cid=' + CID + '&hl=en',
    'https://www.google.com/maps/place/Trash+Titans/@' + LAT + ',' + LNG + ',17z/data=!4m6!3m5!1s' + FEATURE_ID + '!16s%2Fg%2F11z304_ydp',
    'https://www.google.com/search?q=Trash+Titans+Murfreesboro&hl=en&gl=us'
  ];
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html'
        },
        redirect: 'follow'
      });
      if (!res.ok) continue;
      const html = await res.text();
      const got = pickFromJsonLd(html);
      if (got) return got;
    } catch (err) {
      console.error('public lookup error', url, err);
    }
  }
  return null;
}

exports.handler = async function () {
  const now = Date.now();
  if (cache.body && now < cache.expires) {
    return json(200, cache.body);
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  let stats = null;
  if (key) stats = await fromPlacesApi(key);
  if (!stats) stats = await fromPublicLookup();
  if (!stats) return json(200, { ok: false });

  cache = { expires: now + CACHE_MS, body: stats };
  return json(200, stats);
};
