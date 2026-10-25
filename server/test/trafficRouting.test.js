const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTomTomTrafficRoutes } = require('../services/trafficRouting');
const { calculateOptimizedRoute } = require('../services/routeOptimization');

const origin = { name: 'Origin', lat: 13.08, lng: 80.27 };
const destination = { name: 'Destination', lat: 13.05, lng: 80.28 };

function tomtomResponse(routes) {
  return { routes: routes.map((route) => ({
    summary: {
      lengthInMeters: route.distanceKm * 1000,
      travelDurationInSeconds: route.minutes * 60,
      trafficDelayDurationInSeconds: route.delayMinutes * 60,
    },
    legs: [{ path: { coordinates: [[80.27, 13.08], [80.275, 13.065], [80.28, 13.05]] } }],
  })) };
}

test('TomTom request asks for live traffic, alternatives, and uses backend API key header', async () => {
  let request;
  const result = await calculateTomTomTrafficRoutes(origin, destination, 'time', {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => tomtomResponse([
        { distanceKm: 4, minutes: 18, delayMinutes: 8 },
        { distanceKm: 5, minutes: 12, delayMinutes: 3 },
      ]) };
    },
  });

  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['TomTom-Api-Key'], 'test-key');
  assert.match(request.url, /apiVersion=3/);
  assert.equal(request.options.headers.Attributes, 'routes');
  const body = JSON.parse(request.options.body);
  assert.equal(body.traffic, 'live');
  assert.equal(body.maxPathAlternativeRoutes, 3);
  assert.equal(body.routeType, 'fast');
  assert.deepEqual(body.routePlanningLocations.origin.coordinates, [origin.lng, origin.lat]);
  assert.equal(result.trafficStatus.state, 'live');
  assert.ok(result.trafficStatus.retrievedAt);
});

test('TomTom alternatives are selected by actual travel-time metric', async () => {
  const result = await calculateTomTomTrafficRoutes(origin, destination, 'time', {
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: true, json: async () => tomtomResponse([
      { distanceKm: 4, minutes: 18, delayMinutes: 8 },
      { distanceKm: 5, minutes: 12, delayMinutes: 3 },
    ]) }),
  });
  assert.equal(result.selectedRoute.estimatedMinutes, 12);
  assert.equal(result.selectedRoute.trafficDelayMinutes, 3);
  assert.deepEqual(result.selectedRoute.geometry[0], [13.08, 80.27]);
});

  test('route orchestration selects the fastest of unsorted live alternatives', async () => {
    const result = await calculateOptimizedRoute(origin, destination, 'time', {
      tomtomApiKey: 'test-key',
      trafficRouter: async () => ({
        routes: [
          { id: 'slow', distanceKm: 3, estimatedMinutes: 18, geometry: [[13.08, 80.27], [13.05, 80.28]], trafficDelayMinutes: 9 },
          { id: 'fast', distanceKm: 4, estimatedMinutes: 12, geometry: [[13.08, 80.27], [13.06, 80.29], [13.05, 80.28]], trafficDelayMinutes: 2 },
        ],
        provider: 'TomTom Orbis Routing API v3',
        trafficStatus: { state: 'live', message: 'live', retrievedAt: new Date().toISOString(), delayMinutes: 9 },
      }),
    });
    assert.equal(result.id, 'fast');
    assert.equal(result.selectedRouteId, 'fast');
    assert.equal(result.estimatedMinutes, 12);
  });

  test('route orchestration selects shortest of unsorted live alternatives', async () => {
    const result = await calculateOptimizedRoute(origin, destination, 'distance', {
      tomtomApiKey: 'test-key',
      trafficRouter: async () => ({
        routes: [
          { id: 'long', distanceKm: 5, estimatedMinutes: 10, geometry: [[13.08, 80.27], [13.05, 80.28]] },
          { id: 'short', distanceKm: 3, estimatedMinutes: 18, geometry: [[13.08, 80.27], [13.05, 80.28]] },
        ],
        provider: 'TomTom Orbis Routing API v3',
        trafficStatus: { state: 'live', message: 'live', retrievedAt: new Date().toISOString(), delayMinutes: 1 },
      }),
    });
    assert.equal(result.id, 'short');
    assert.equal(result.selectedRouteId, 'short');
    assert.equal(result.distanceKm, 3);
  });

test('TomTom shortest objective compares returned alternative distances', async () => {
  const result = await calculateTomTomTrafficRoutes(origin, destination, 'distance', {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      assert.equal(JSON.parse(options.body).routeType, 'short');
      return { ok: true, json: async () => tomtomResponse([
        { distanceKm: 4, minutes: 18, delayMinutes: 8 },
        { distanceKm: 5, minutes: 12, delayMinutes: 3 },
      ]) };
    },
  });
  assert.equal(result.selectedRoute.distanceKm, 4);
});

test('TomTom traffic adapter fails clearly when API key is missing', async () => {
  await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', { apiKey: '' }), {
    providerCode: 'MISSING_API_KEY',
    statusCode: 503,
  });
});

test('TomTom traffic adapter distinguishes authentication and rate-limit errors', async (t) => {
  await t.test('authentication', async () => {
    await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', {
      apiKey: 'invalid', fetchImpl: async () => ({ ok: false, status: 403 }),
    }), { providerCode: 'AUTHENTICATION', statusCode: 403 });
  });
  await t.test('rate limit', async () => {
    await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', {
      apiKey: 'test-key', fetchImpl: async () => ({ ok: false, status: 429 }),
    }), { providerCode: 'RATE_LIMIT', statusCode: 429 });
  });
    await t.test('service error', async () => {
      await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', {
        apiKey: 'test-key', fetchImpl: async () => ({ ok: false, status: 500 }),
      }), { providerCode: 'PROVIDER_ERROR', statusCode: 502 });
    });
});

test('TomTom traffic adapter handles timeouts and malformed responses', async (t) => {
  await t.test('timeout', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', {
      apiKey: 'test-key', fetchImpl: async () => { throw timeout; },
    }), { providerCode: 'TIMEOUT', statusCode: 504 });
  });
  await t.test('missing route summary', async () => {
    await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', {
      apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => ({ routes: [{}] }) }),
    }), { providerCode: 'INVALID_RESPONSE', statusCode: 502 });
  });
  await t.test('malformed JSON', async () => {
    await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', {
      apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('invalid json'); } }),
    }), { providerCode: 'MALFORMED_RESPONSE', statusCode: 502 });
  });
  await t.test('no route', async () => {
    await assert.rejects(calculateTomTomTrafficRoutes(origin, destination, 'time', {
      apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => ({ routes: [] }) }),
    }), { providerCode: 'NO_ROUTE', statusCode: 404 });
  });
});

test('missing key uses OSRM and marks live traffic unavailable', async () => {
  let tomtomCalled = false;
  const result = await calculateOptimizedRoute(origin, destination, 'time', {
    tomtomApiKey: '',
    trafficRouter: async () => { tomtomCalled = true; },
    standardRouter: async () => ({
      distanceKm: 4.5,
      estimatedMinutes: 15,
      geometry: [[13.08, 80.27], [13.05, 80.28]],
      provider: 'OSRM / OpenStreetMap',
      alternatives: [{ id: 'osrm-0', distanceKm: 4.5, estimatedMinutes: 15, geometry: [[13.08, 80.27], [13.05, 80.28]] }],
      selectedAlternativeId: 'osrm-0',
    }),
  });
  assert.equal(tomtomCalled, false);
  assert.equal(result.provider, 'OSRM / OpenStreetMap');
  assert.equal(result.trafficStatus.state, 'unavailable');
  assert.match(result.trafficStatus.message, /Live traffic data is not configured/);
});

test('TomTom failure falls back to OSRM with explicit fallback status', async () => {
  const result = await calculateOptimizedRoute(origin, destination, 'time', {
    tomtomApiKey: 'invalid',
    trafficRouter: async () => { throw Object.assign(new Error('provider down'), { providerCode: 'NETWORK_ERROR' }); },
    standardRouter: async () => ({ distanceKm: 8, estimatedMinutes: 20, geometry: [[13.08, 80.27], [13.05, 80.28]], provider: 'OSRM / OpenStreetMap', alternatives: [] }),
  });
  assert.equal(result.provider, 'OSRM / OpenStreetMap');
  assert.equal(result.trafficStatus.state, 'fallback');
  assert.match(result.trafficStatus.message, /standard road route/);
  assert.equal(result.trafficStatus.fallbackReason, 'NETWORK_ERROR');
});

test('TomTom rate limit falls back to standard OSRM and preserves the reason', async () => {
  const result = await calculateOptimizedRoute(origin, destination, 'time', {
    tomtomApiKey: 'test-key',
    trafficRouter: async () => { throw Object.assign(new Error('rate limited'), { providerCode: 'RATE_LIMIT', statusCode: 429 }); },
    standardRouter: async () => ({ distanceKm: 3, estimatedMinutes: 11, geometry: [[13.08, 80.27], [13.05, 80.28]], provider: 'OSRM / OpenStreetMap', alternatives: [] }),
  });
  assert.equal(result.trafficStatus.state, 'fallback');
  assert.equal(result.trafficStatus.fallbackReason, 'RATE_LIMIT');
  assert.equal(result.distanceKm, 3);
});

test('without a live key, OSRM alternatives still follow the requested objective', async () => {
  const standardRouter = async () => ({
    provider: 'OSRM / OpenStreetMap',
    alternatives: [
      { id: 'long-fast', distanceKm: 6, estimatedMinutes: 8, geometry: [[13.08, 80.27], [13.05, 80.28]] },
      { id: 'short-slow', distanceKm: 4, estimatedMinutes: 13, geometry: [[13.08, 80.27], [13.06, 80.27], [13.05, 80.28]] },
    ],
  });
  const fastest = await calculateOptimizedRoute(origin, destination, 'time', { tomtomApiKey: '', standardRouter });
  const shortest = await calculateOptimizedRoute(origin, destination, 'distance', { tomtomApiKey: '', standardRouter });
  assert.equal(fastest.selectedRouteId, 'long-fast');
  assert.equal(fastest.trafficStatus.state, 'unavailable');
  assert.equal(shortest.selectedRouteId, 'short-slow');
  assert.equal(shortest.trafficStatus.state, 'unavailable');
});