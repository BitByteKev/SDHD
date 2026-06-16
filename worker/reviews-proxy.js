// reviews-proxy — fetches Google Places reviews server-side, caches in KV,
// serves CORS-locked JSON to sdhaulinganddemo.com.
// Bindings (set in Cloudflare dashboard):
//   KV namespace: REVIEWS_KV
//   Secret:       GOOGLE_PLACES_API_KEY
//   Var:          PLACE_ID
// Cron Trigger: once daily.

const KV_KEY = 'reviews:latest';
const ALLOWED_ORIGIN = 'https://sdhaulinganddemo.com';

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join('');
}

function normalize(data) {
  const reviews = (data.reviews || []).slice(0, 5).map(function (r) {
    const name =
      (r.authorAttribution && r.authorAttribution.displayName) || 'Google user';
    const text =
      (r.text && r.text.text) ||
      (r.originalText && r.originalText.text) ||
      '';
    return {
      name: name,
      initials: initials(name),
      rating: r.rating || 0,
      text: text,
      time: r.publishTime || '',
    };
  });
  return {
    rating: data.rating || 0,
    total: data.userRatingCount || 0,
    mapsUri: data.googleMapsUri || '',
    updated: new Date().toISOString(),
    reviews: reviews,
  };
}

async function fetchFromGoogle(env) {
  const url = 'https://places.googleapis.com/v1/places/' + env.PLACE_ID;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri',
    },
  });
  if (!res.ok) throw new Error('Places API ' + res.status);
  return normalize(await res.json());
}

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    let payload = await env.REVIEWS_KV.get(KV_KEY);
    if (!payload) {
      try {
        payload = JSON.stringify(await fetchFromGoogle(env));
        await env.REVIEWS_KV.put(KV_KEY, payload);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'unavailable' }), {
          status: 502,
          headers: { ...CORS, 'Cache-Control': 'no-store' },
        });
      }
    }
    return new Response(payload, {
      headers: { ...CORS, 'Cache-Control': 'public, max-age=21600' },
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async function () {
        try {
          const data = await fetchFromGoogle(env);
          await env.REVIEWS_KV.put(KV_KEY, JSON.stringify(data));
        } catch (e) {
          console.error('reviews-proxy scheduled refresh failed:', e);
        }
      })()
    );
  },
};
