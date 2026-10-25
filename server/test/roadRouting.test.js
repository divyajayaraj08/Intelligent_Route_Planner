const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRoadRoute, calculateRouteBetweenLocations, calculateWithFallback } = require('../services/roadRouting');
const roadNetwork = require('../data/roadNetwork');
const { simulateTraffic } = require('../utils/trafficSimulator');

test('OSRM adapter selects the shortest-distance alternative and returns road geometry', async () => {
  let requestedUrl;
  const fetchStub = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          { distance: 2400, duration: 300, geometry: { coordinates: [[77.5946, 12.9716], [77.6014, 12.9613]] } },
          { distance: 1800, duration: 360, geometry: { coordinates: [[77.5946, 12.9716], [77.599, 12.965], [77.6014, 12.9613]] } },
        ],
      }),
    };
  };

  const route = await calculateRoadRoute(roadNetwork, 'A', 'E', 'distance', fetchStub);
  assert.equal(route.distanceKm, 1.8);
  assert.equal(route.estimatedMinutes, 6);
  assert.equal(route.provider, 'OSRM / OpenStreetMap');
  assert.equal(route.geometry.length, 3);
  assert.deepEqual(route.geometry[0], [12.9716, 77.5946]);
  assert.match(requestedUrl, /alternatives=true/);
});

test('OSRM adapter selects the fastest alternative for time optimization', async () => {
  const fetchStub = async () => ({
    ok: true,
    json: async () => ({
      code: 'Ok',
      routes: [
        { distance: 1800, duration: 360, geometry: { coordinates: [[77.5946, 12.9716], [77.6014, 12.9613]] } },
        { distance: 2400, duration: 300, geometry: { coordinates: [[77.5946, 12.9716], [77.6014, 12.9613]] } },
      ],
    }),
  });

  const route = await calculateRoadRoute(roadNetwork, 'A', 'E', 'time', fetchStub);
  assert.equal(route.distanceKm, 2.4);
  assert.equal(route.estimatedMinutes, 5);
});

test('traffic simulation recomputes from baseline rather than compounding', () => {
  const moderate = simulateTraffic(roadNetwork, 'moderate');
  const heavyAfterModerate = simulateTraffic(moderate, 'heavy');
  const heavyFromBaseline = simulateTraffic(roadNetwork, 'heavy');

  assert.deepEqual(
    heavyAfterModerate.edges.map((edge) => edge.estimatedMinutes),
    heavyFromBaseline.edges.map((edge) => edge.estimatedMinutes),
  );
  assert.deepEqual(
    heavyAfterModerate.edges.map((edge) => edge.cost),
    heavyFromBaseline.edges.map((edge) => edge.cost),
  );
});

test('road routing outage uses and labels the graph fallback', async () => {
  const result = await calculateWithFallback({
    graph: roadNetwork,
    source: 'A',
    destination: 'E',
    algorithm: 'dijkstra',
    optimization: 'distance',
    mode: 'road',
    roadRouter: async () => { throw new Error('provider offline'); },
    graphRouter: (graph, source, destination, optimization) => require('../algorithms/dijkstra').calculateRoute(graph, source, destination, optimization),
  });

  assert.equal(result.routingMode, 'demo-fallback');
  assert.equal(result.fallbackReason, 'provider offline');
  assert.deepEqual(result.result.path[0], 'A');
});

test('OSRM accepts arbitrary coordinates outside the fixed demo graph', async () => {
  let requestedUrl;
  const origin = { name: 'Chennai Central', lat: 13.0827, lng: 80.2707 };
  const destination = { name: 'Marina Beach', lat: 13.0500, lng: 80.2824 };
  const route = await calculateRouteBetweenLocations(origin, destination, 'distance', async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 5000,
          duration: 600,
          geometry: { coordinates: [[origin.lng, origin.lat], [80.276, 13.066], [destination.lng, destination.lat]] },
        }],
      }),
    };
  });

  assert.equal(route.distanceKm, 5);
  assert.equal(route.estimatedMinutes, 10);
  assert.equal(route.geometry.length, 3);
  assert.deepEqual(route.sourceNode.coords, { lat: origin.lat, lng: origin.lng });
  assert.match(requestedUrl.pathname, /80\.2707,13\.0827;80\.2824,13\.05/);
});

test('OSRM rejects malformed arbitrary coordinates before requesting a route', async () => {
  await assert.rejects(
    calculateRouteBetweenLocations({ name: 'Invalid', lat: 120, lng: 80 }, { name: 'Valid', lat: 13, lng: 80 }, 'distance', async () => assert.fail('No request should be made')),
    /invalid coordinates/i,
  );
  await assert.rejects(
    calculateRouteBetweenLocations({ name: 'Blank latitude', lat: '', lng: 80 }, { name: 'Valid', lat: 13, lng: 80 }, 'distance', async () => assert.fail('No request should be made')),
    /invalid coordinates/i,
  );
});

test('OSRM reports no road route instead of returning a synthetic success', async () => {
  await assert.rejects(
    calculateRouteBetweenLocations(
      { name: 'Origin', lat: 13, lng: 80 },
      { name: 'Destination', lat: -13, lng: -80 },
      'distance',
      async () => ({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) }),
    ),
    { statusCode: 404, message: /found no route/i },
  );
});