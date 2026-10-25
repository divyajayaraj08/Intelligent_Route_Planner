const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_TIMEOUT_MS = 8000;
const MIN_REQUEST_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const cache = new Map();
let nextRequestAt = 0;
let requestQueue = Promise.resolve();

function normalizeResult(result) {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;

  return {
    id: String(result.place_id),
    name: result.name || result.display_name.split(',')[0],
    displayName: result.display_name,
    address: result.address || {},
    lat,
    lng,
    type: result.type,
    category: result.category,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleRequest() {
  const scheduled = requestQueue.then(async () => {
    const waitMs = Math.max(0, nextRequestAt - Date.now());
    if (waitMs) await delay(waitMs);
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  });
  requestQueue = scheduled.catch(() => {});
  await scheduled;
}

async function searchLocations(query, fetchImpl = fetch) {
  if (typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 160) {
    const error = new Error('Search query must be between 3 and 160 characters.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const cacheKey = normalizedQuery.toLocaleLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  await throttleRequest();
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  if (process.env.NOMINATIM_CONTACT) url.searchParams.set('email', process.env.NOMINATIM_CONTACT);

  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'User-Agent': 'SmartRoute/1.0 (OpenStreetMap Nominatim geocoding)' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const error = new Error(cause.name === 'TimeoutError' ? 'Location search timed out. Please try again.' : 'Location search service is unavailable.');
    error.statusCode = 503;
    error.cause = cause;
    throw error;
  }

  if (response.status === 429) {
    const error = new Error('Location search rate limit reached. Please wait before searching again.');
    error.statusCode = 429;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Location search service returned HTTP ${response.status}.`);
    error.statusCode = 503;
    throw error;
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    const error = new Error('Location search service returned an invalid response.');
    error.statusCode = 503;
    throw error;
  }

  const results = payload.map(normalizeResult).filter(Boolean);
  if (cache.size >= MAX_CACHE_SIZE) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS });
  return results;
}

module.exports = { searchLocations };