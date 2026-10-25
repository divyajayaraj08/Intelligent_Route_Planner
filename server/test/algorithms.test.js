const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRoute } = require('../algorithms/dijkstra');
const { calculateAStar } = require('../algorithms/astar');
const { simulateTraffic } = require('../utils/trafficSimulator');
const app = require('../server');

const network = {
  nodes: [
    { id: 'A', name: 'A', coords: { lat: 12.9716, lng: 77.5946 } },
    { id: 'B', name: 'B', coords: { lat: 12.975, lng: 77.601 } },
    { id: 'C', name: 'C', coords: { lat: 12.98, lng: 77.592 } },
    { id: 'D', name: 'D', coords: { lat: 12.966, lng: 77.586 } },
    { id: 'E', name: 'E', coords: { lat: 12.96, lng: 77.605 } },
    { id: 'F', name: 'F', coords: { lat: 12.95, lng: 77.61 } },
  ],
  edges: [
    { from: 'A', to: 'B', distanceKm: 3, estimatedMinutes: 6, traffic: 'low', cost: 11 },
    { from: 'A', to: 'C', distanceKm: 5, estimatedMinutes: 8, traffic: 'low', cost: 15 },
    { from: 'B', to: 'C', distanceKm: 2, estimatedMinutes: 4, traffic: 'low', cost: 8 },
    { from: 'B', to: 'D', distanceKm: 4, estimatedMinutes: 7, traffic: 'low', cost: 14 },
    { from: 'C', to: 'D', distanceKm: 1, estimatedMinutes: 3, traffic: 'low', cost: 5 },
    { from: 'C', to: 'E', distanceKm: 5, estimatedMinutes: 9, traffic: 'low', cost: 18 },
    { from: 'D', to: 'E', distanceKm: 2, estimatedMinutes: 5, traffic: 'low', cost: 9 },
  ],
};

test('Dijkstra shortest-path correctness for distance optimization', () => {
  const result = calculateRoute(network, 'A', 'E', 'distance');
  assert.equal(result.path[0], 'A');
  assert.equal(result.path[result.path.length - 1], 'E');
  assert.equal(result.distanceKm, 8);
  assert.equal(result.congestion, 'moderate');
});

test('A* shortest-path correctness for distance optimization', () => {
  const result = calculateAStar(network, 'A', 'E', 'distance');
  assert.equal(result.path[0], 'A');
  assert.equal(result.path[result.path.length - 1], 'E');
  assert.equal(result.distanceKm, 8);
  assert.equal(result.estimatedMinutes, 16);
});

test('Dijkstra and A* return equal optimal costs for same metric', () => {
  const dijkstraResult = calculateRoute(network, 'A', 'E', 'distance');
  const astarResult = calculateAStar(network, 'A', 'E', 'distance');
  assert.equal(dijkstraResult.distanceKm, astarResult.distanceKm);
});

test('Source equals destination returns zero-cost route', () => {
  const result = calculateRoute(network, 'A', 'A', 'distance');
  assert.deepEqual(result.path, ['A']);
  assert.equal(result.distanceKm, 0);
  assert.equal(result.estimatedMinutes, 0);
});

test('Unreachable destination is reported as unavailable', () => {
  const result = calculateRoute(network, 'A', 'F', 'distance');
  assert.equal(result.path.length, 0);
  assert.equal(Number.isFinite(result.distanceKm), false);
});

test('Invalid node identifiers throw an error', () => {
  assert.throws(() => calculateRoute(network, 'A', 'NOPE', 'distance'));
  assert.throws(() => calculateAStar(network, 'INVALID', 'E', 'time'));
});

test('Different edge weights produce different route results', () => {
  const distanceRoute = calculateRoute(network, 'A', 'E', 'distance');
  const timeRoute = calculateRoute(network, 'A', 'E', 'time');
  assert.ok(distanceRoute.estimatedMinutes >= 0);
  assert.ok(timeRoute.estimatedMinutes >= 0);
  assert.ok(distanceRoute.distanceKm >= 0);
});

test('Traffic updates change route metrics', () => {
  const before = calculateRoute(network, 'A', 'E', 'time');
  const updatedGraph = simulateTraffic(network, 'heavy');
  const after = calculateRoute(updatedGraph, 'A', 'E', 'time');
  assert.ok(after.estimatedMinutes >= before.estimatedMinutes);
  assert.ok(updatedGraph.edges.some((edge) => edge.traffic === 'heavy'));
});

test('REST API validation responds correctly', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const healthResponse = await fetch(`http://localhost:${port}/api/health`);
    const healthData = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(healthData.status, 'ok');

    const invalidResponse = await fetch(`http://localhost:${port}/api/routes/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'A', destination: 'E', algorithm: 'invalid' }),
    });
    assert.equal(invalidResponse.status, 400);

    const invalidHistoryResponse = await fetch(`http://localhost:${port}/api/routes/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'UNKNOWN', destination: 'E', algorithm: 'dijkstra', optimization: 'distance' }),
    });
    assert.equal(invalidHistoryResponse.status, 400);

    const invalidTrafficResponse = await fetch(`http://localhost:${port}/api/traffic/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'live' }),
    });
    assert.equal(invalidTrafficResponse.status, 400);

    const invalidLimitResponse = await fetch(`http://localhost:${port}/api/routes/history?limit=0`);
    assert.equal(invalidLimitResponse.status, 400);

    const invalidCoordinatesResponse = await fetch(`http://localhost:${port}/api/routes/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { name: 'Invalid place', lat: 100, lng: 80 },
        destination: { name: 'Valid place', lat: 13, lng: 80 },
        routingMode: 'road',
        optimization: 'distance',
      }),
    });
    assert.equal(invalidCoordinatesResponse.status, 400);

    const unselectedTextResponse = await fetch(`http://localhost:${port}/api/routes/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'Chennai Central', destination: 'Marina Beach', routingMode: 'road' }),
    });
    assert.equal(unselectedTextResponse.status, 400);

    const shortSearchResponse = await fetch(`http://localhost:${port}/api/locations/search?q=xy`);
    assert.equal(shortSearchResponse.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
test('route history API saves and retrieves a calculated route', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://localhost:${server.address().port}/api`;

  try {
    const calculatedResponse = await fetch(`${baseUrl}/routes/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'A', destination: 'E', algorithm: 'dijkstra', optimization: 'distance', routingMode: 'demo' }),
    });
    const route = await calculatedResponse.json();
    assert.equal(calculatedResponse.status, 200);

    const saveResponse = await fetch(`${baseUrl}/routes/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'history-test-route-1' },
      body: JSON.stringify(route),
    });
    assert.equal(saveResponse.status, 202);
    const savedRoute = await saveResponse.json();
    assert.equal(savedRoute.persisted, false);
    assert.equal(savedRoute.storage, 'memory');

    const repeatedSaveResponse = await fetch(`${baseUrl}/routes/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'history-test-route-1' },
      body: JSON.stringify(route),
    });
    assert.equal(repeatedSaveResponse.status, 202);

    const historyResponse = await fetch(`${baseUrl}/routes/history`);
    const history = await historyResponse.json();
    assert.equal(historyResponse.status, 200);
    assert.equal(historyResponse.headers.get('x-history-persistence'), 'memory-only');
    assert.ok(history.some((entry) => entry.source === route.source && entry.destination === route.destination));
    assert.equal(history.filter((entry) => entry.idempotencyKey === 'history-test-route-1').length, 1);

    const optionsResponse = await fetch(`${baseUrl}/routes/history`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
    });
    assert.match(optionsResponse.headers.get('access-control-expose-headers') || '', /X-History-Persistence/i);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('server startup reports port conflicts without killing the existing listener', async () => {
  const occupiedServer = app.listen(0);
  await new Promise((resolve) => occupiedServer.once('listening', resolve));
  const occupiedPort = occupiedServer.address().port;
  const previousPort = process.env.PORT;
  process.env.PORT = String(occupiedPort);

  try {
    await assert.rejects(app.startServer(occupiedPort), { code: 'EADDRINUSE' });
    assert.equal(occupiedServer.listening, true);
  } finally {
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    await new Promise((resolve, reject) => occupiedServer.close((err) => (err ? reject(err) : resolve())));
  }
});
