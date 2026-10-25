const TOMTOM_ROUTE_URL = 'https://api.tomtom.com/maps/orbis/routing/routes/calculate?apiVersion=3';
const REQUEST_TIMEOUT_MS = 10000;

function providerError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.providerCode = code;
  return error;
}

function normalizeTomTomRoute(route, index) {
  const summary = route?.summary;
  const distanceKm = Number(summary?.lengthInMeters) / 1000;
  const estimatedMinutes = Number(summary?.travelDurationInSeconds) / 60;
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(estimatedMinutes) || estimatedMinutes < 0) {
    throw providerError('TomTom returned a route with invalid distance or travel-time data.', 502, 'INVALID_RESPONSE');
  }

  const geometry = (route.legs || []).flatMap((leg) => leg.path?.coordinates || [])
    .filter((coordinate) => Array.isArray(coordinate) && coordinate.length === 2
      && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1])))
    .map(([lng, lat]) => [Number(lat), Number(lng)]);
  if (geometry.length < 2) {
    throw providerError('TomTom returned a route without usable geometry.', 502, 'INVALID_GEOMETRY');
  }

  const delaySeconds = Number(summary.trafficDelayDurationInSeconds);
  return {
    id: `tomtom-${index}`,
    distanceKm,
    estimatedMinutes,
    trafficDelayMinutes: Number.isFinite(delaySeconds) ? delaySeconds / 60 : null,
    geometry,
  };
}

async function calculateTomTomTrafficRoutes(origin, destination, optimization = 'time', options = {}) {
  const apiKey = options.apiKey ?? process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    throw providerError('TomTom traffic routing is not configured.', 503, 'MISSING_API_KEY');
  }
  if (!['distance', 'time'].includes(optimization)) {
    throw providerError('Optimization must be distance or time.', 400, 'INVALID_OPTIMIZATION');
  }

  const fetchImpl = options.fetchImpl || fetch;
  const url = options.url || TOMTOM_ROUTE_URL;
  const requestBody = {
    routePlanningLocations: {
      origin: { type: 'Point', coordinates: [origin.lng, origin.lat] },
      destination: { type: 'Point', coordinates: [destination.lng, destination.lat] },
    },
    routeType: optimization === 'time' ? 'fast' : 'short',
    traffic: 'live',
    maxPathAlternativeRoutes: 3,
  };

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TomTom-Api-Key': apiKey,
        'TomTom-Api-Version': '3',
        Attributes: 'routes',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause.name === 'TimeoutError';
    throw providerError(timedOut ? 'TomTom traffic routing timed out.' : 'TomTom traffic routing is unreachable.', timedOut ? 504 : 502, timedOut ? 'TIMEOUT' : 'NETWORK_ERROR');
  }

  if (response.status === 401 || response.status === 403) {
    throw providerError('TomTom rejected the configured API key or account.', response.status, 'AUTHENTICATION');
  }
  if (response.status === 429) {
    throw providerError('TomTom traffic routing rate limit reached.', 429, 'RATE_LIMIT');
  }
  if (!response.ok) {
    throw providerError(`TomTom traffic routing returned HTTP ${response.status}.`, 502, 'PROVIDER_ERROR');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw providerError('TomTom returned malformed JSON.', 502, 'MALFORMED_RESPONSE');
  }
  if (!Array.isArray(payload.routes) || payload.routes.length === 0) {
    throw providerError('TomTom found no route for these locations.', 404, 'NO_ROUTE');
  }

  const routes = payload.routes.map(normalizeTomTomRoute);
  const selectedRoute = routes.reduce((best, candidate) => {
    const metric = optimization === 'time' ? 'estimatedMinutes' : 'distanceKm';
    return candidate[metric] < best[metric] ? candidate : best;
  });

  return {
    routes,
    selectedRoute,
    provider: 'TomTom Orbis Routing API v3',
    trafficStatus: {
      state: 'live',
      message: 'Live traffic-aware route calculated by TomTom.',
      retrievedAt: new Date().toISOString(),
      delayMinutes: selectedRoute.trafficDelayMinutes,
    },
  };
}

module.exports = { calculateTomTomTrafficRoutes, normalizeTomTomRoute, TOMTOM_ROUTE_URL };