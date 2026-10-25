const ROUTER_URL = 'https://router.project-osrm.org/route/v1/driving';
const REQUEST_TIMEOUT_MS = 8000;

function validateLocation(location, label) {
  const rawLat = location?.lat ?? location?.coords?.lat;
  const rawLng = location?.lng ?? location?.lon ?? location?.coords?.lng;
  if ((typeof rawLat === 'string' && !rawLat.trim()) || (typeof rawLng === 'string' && !rawLng.trim())) {
    throw new Error(`${label} has invalid coordinates.`);
  }
  if (typeof location?.name !== 'string' || !location.name.trim() || location.name.trim().length > 500) {
    throw new Error(`${label} must include a valid selected location name.`);
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`${label} has invalid coordinates.`);
  }
  return { lat, lng };
}

async function calculateRouteBetweenLocations(origin, destination, optimization = 'distance', fetchImpl = fetch) {
  const start = validateLocation(origin, 'Origin');
  const end = validateLocation(destination, 'Destination');

  if (start.lat === end.lat && start.lng === end.lng) {
    return {
      path: [origin.name || 'Origin', destination.name || 'Destination'],
      distanceKm: 0,
      estimatedMinutes: 0,
      totalCost: 0,
      pathNodes: [],
      sourceNode: { ...origin, coords: start },
      destinationNode: { ...destination, coords: end },
      congestion: 'unknown',
      geometry: [[start.lat, start.lng]],
      provider: 'OSRM / OpenStreetMap',
      routingMode: 'road',
      alternatives: [],
    };
  }

  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = `${ROUTER_URL}/${coordinates}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (cause) {
    const error = new Error(cause.name === 'TimeoutError' ? 'Road routing service timed out.' : 'Road routing service is unavailable.');
    error.statusCode = cause.name === 'TimeoutError' ? 504 : 502;
    error.cause = cause;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Road routing service returned HTTP ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  if (payload.code !== 'Ok' || !Array.isArray(payload.routes) || payload.routes.length === 0) {
    const error = new Error('Road routing service found no route between the selected locations.');
    error.statusCode = 404;
    throw error;
  }

  const selectedRoute = payload.routes.reduce((best, candidate) => {
    const metric = optimization === 'time' ? 'duration' : 'distance';
    return candidate[metric] < best[metric] ? candidate : best;
  });
  const selectedAlternativeIndex = payload.routes.indexOf(selectedRoute);
  if (!Number.isFinite(selectedRoute.distance) || !Number.isFinite(selectedRoute.duration)) {
    const error = new Error('Road routing service returned invalid route metrics.');
    error.statusCode = 502;
    throw error;
  }

  const geometry = selectedRoute.geometry?.coordinates;
  if (!Array.isArray(geometry) || geometry.length < 2) {
    const error = new Error('Road routing service returned no route geometry.');
    error.statusCode = 502;
    throw error;
  }

  const estimatedMinutes = selectedRoute.duration / 60;
  const alternatives = payload.routes.map((route, index) => ({
    id: `osrm-${index}`,
    selected: index === selectedAlternativeIndex,
    distanceKm: route.distance / 1000,
    estimatedMinutes: route.duration / 60,
    geometry: route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [],
  }));
  return {
    path: [origin.name || 'Origin', destination.name || 'Destination'],
    distanceKm: selectedRoute.distance / 1000,
    estimatedMinutes,
    totalCost: selectedRoute.distance / 1000 + estimatedMinutes * 0.4,
    pathNodes: [],
    sourceNode: { ...origin, coords: start },
    destinationNode: { ...destination, coords: end },
    congestion: 'unknown',
    geometry: geometry.map(([lng, lat]) => [lat, lng]),
    provider: 'OSRM / OpenStreetMap',
    routingMode: 'road',
    alternatives,
    selectedAlternativeId: alternatives[selectedAlternativeIndex]?.id,
  };
}

async function calculateRoadRoute(graph, source, destination, optimization = 'distance', fetchImpl = fetch) {
  const sourceNode = graph.nodes.find((node) => node.id === source);
  const destinationNode = graph.nodes.find((node) => node.id === destination);
  if (!sourceNode || !destinationNode) throw new Error('Unknown road-routing endpoint.');
  return calculateRouteBetweenLocations(
    { id: source, name: sourceNode.name, coords: sourceNode.coords },
    { id: destination, name: destinationNode.name, coords: destinationNode.coords },
    optimization,
    fetchImpl,
  );
}

async function calculateWithFallback({ graph, source, destination, algorithm, optimization, mode, roadRouter = calculateRoadRoute, graphRouter }) {
  if (mode === 'demo') {
    return { result: graphRouter(graph, source, destination, optimization), routingMode: 'demo' };
  }

  try {
    return {
      result: await roadRouter(graph, source, destination, optimization),
      routingMode: 'road',
    };
  } catch (error) {
    return {
      result: graphRouter(graph, source, destination, optimization),
      routingMode: 'demo-fallback',
      fallbackReason: error.message,
    };
  }
}

module.exports = { calculateRoadRoute, calculateRouteBetweenLocations, calculateWithFallback, validateLocation };