const mongoose = require('mongoose');
const { calculateRoute: dijkstraRoute } = require('../algorithms/dijkstra');
const { calculateAStar } = require('../algorithms/astar');
const { simulateTraffic, trafficLevels } = require('../utils/trafficSimulator');
const { calculateWithFallback, validateLocation } = require('../services/roadRouting');
const { calculateOptimizedRoute } = require('../services/routeOptimization');
const { searchLocations } = require('../services/geocoding');
const roadNetworkData = require('../data/roadNetwork');
const RouteHistory = require('../models/RouteHistory');

const memoryHistory = [];
let trafficState = simulateTraffic(roadNetworkData, 'low');

function buildResult(source, destination, algorithm, optimization, result) {
  return {
    path: result.path,
    distanceKm: Number(result.distanceKm.toFixed(1)),
    estimatedMinutes: Number(result.estimatedMinutes.toFixed(1)),
    totalCost: Number((result.totalCost ?? 0).toFixed(2)),
    algorithm,
    optimization,
    source,
    destination,
    executionTimeMs: 0,
    pathNodes: result.pathNodes,
    sourceNode: result.sourceNode,
    destinationNode: result.destinationNode,
    congestion: result.congestion || 'unknown',
  };
}

function toHistoryRecord(payload) {
  return {
    source: payload.source,
    destination: payload.destination,
    algorithm: payload.algorithm,
    optimization: payload.optimization,
    path: Array.isArray(payload.path) ? payload.path : [],
    distance: Number(payload.distanceKm ?? payload.distance ?? 0),
    estimatedTime: Number(payload.estimatedMinutes ?? payload.estimatedTime ?? 0),
    totalCost: Number(payload.totalCost ?? 0),
    executionTime: Number(payload.executionTimeMs ?? payload.executionTime ?? 0),
    congestion: payload.congestion || 'low',
    trafficStatus: payload.trafficStatus,
    alternatives: Array.isArray(payload.alternatives) ? payload.alternatives : [],
    trafficRetrievedAt: payload.trafficRetrievedAt || null,
    geometry: Array.isArray(payload.geometry) ? payload.geometry : [],
    provider: payload.provider || 'demo graph',
    routingMode: payload.routingMode || 'demo',
    origin: payload.origin,
    destinationLocation: payload.destinationLocation,
    createdAt: new Date(),
  };
}

exports.health = (req, res) => {
  const databaseStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const database = databaseStates[mongoose.connection.readyState] || 'unavailable';
  res.json({
    status: 'ok',
    database,
    databaseReady: mongoose.connection.readyState === 1,
    historyPersistence: mongoose.connection.readyState === 1 ? 'mongodb' : 'memory-only',
    trafficMode: 'simulated-demo-only',
    liveTrafficConfigured: Boolean(process.env.TOMTOM_API_KEY),
    trafficLevel: trafficState.trafficLevel || 'low',
    trafficMultiplier: trafficState.trafficMultiplier || 1,
    routingProvider: 'Nominatim geocoding and OSRM road routing; synthetic graph is separate demo mode',
  });
};

exports.getLocations = (req, res) => {
  res.json(trafficState.nodes);
};

exports.searchLocations = async (req, res) => {
  try {
    const results = await searchLocations(req.query.q);
    return res.json({ results, provider: 'OpenStreetMap Nominatim' });
  } catch (error) {
    return res.status(error.statusCode || 503).json({ error: error.message || 'Location search failed.' });
  }
};

exports.calculateRoute = async (req, res) => {
  try {
    const { source, destination, algorithm = 'dijkstra', optimization = 'distance' } = req.body || {};
    if (!['dijkstra', 'astar'].includes(algorithm)) {
      return res.status(400).json({ error: 'Algorithm must be dijkstra or astar.' });
    }
    if (!['distance', 'time'].includes(optimization)) {
      return res.status(400).json({ error: 'Optimization must be distance or time.' });
    }

    const startTime = Date.now();
    const requestedMode = req.body.routingMode || 'road';
    if (!['road', 'demo'].includes(requestedMode)) {
      return res.status(400).json({ error: 'Routing mode must be road or demo.' });
    }

    if (requestedMode === 'road') {
      if (!source || !destination || typeof source !== 'object' || typeof destination !== 'object') {
        return res.status(400).json({ error: 'Select a geocoded origin and destination before requesting a road route.' });
      }
      let origin;
      let target;
      try {
        origin = { ...source, ...validateLocation(source, 'Origin') };
        target = { ...destination, ...validateLocation(destination, 'Destination') };
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const result = await calculateOptimizedRoute(origin, target, optimization);
      const payload = buildResult(origin.displayName || origin.name, target.displayName || target.name,
        result.trafficStatus.state === 'live' ? 'tomtom-traffic' : 'osrm', optimization, result);
      payload.routingMode = 'road';
      payload.requestedRoutingMode = 'road';
      payload.requestedAlgorithm = null;
      payload.provider = result.provider;
      payload.geometry = result.geometry;
      payload.alternatives = result.routes.map((route, index) => ({
        id: route.id || `route-${index}`,
        distanceKm: route.distanceKm,
        estimatedMinutes: route.estimatedMinutes,
        trafficDelayMinutes: route.trafficDelayMinutes ?? null,
        geometry: route.geometry,
        selected: route.id === result.selectedRouteId,
      }));
      payload.selectedRouteId = result.selectedRouteId;
      payload.trafficStatus = result.trafficStatus;
      payload.origin = { name: origin.displayName || origin.name, lat: origin.lat, lng: origin.lng };
      payload.destinationLocation = { name: target.displayName || target.name, lat: target.lat, lng: target.lng };
      payload.trafficMode = result.trafficStatus.state;
      payload.trafficRetrievedAt = result.trafficStatus.retrievedAt;
      payload.executionTimeMs = Date.now() - startTime;
      return res.json(payload);
    }

    const validNodeIds = new Set(trafficState.nodes.map((node) => node.id));
    if (!validNodeIds.has(source) || !validNodeIds.has(destination)) {
      return res.status(400).json({ error: 'Demo graph source and destination must be existing node identifiers.' });
    }

    const { result, routingMode: actualMode, fallbackReason } = await calculateWithFallback({
      graph: trafficState,
      source,
      destination,
      algorithm,
      optimization,
      mode: requestedMode,
      graphRouter: algorithm === 'dijkstra' ? dijkstraRoute : calculateAStar,
    });
    if (actualMode === 'road') {
      result.estimatedMinutes *= trafficState.trafficMultiplier || 1;
      result.totalCost = result.distanceKm + result.estimatedMinutes * 0.4;
      result.trafficMode = 'simulated';
      result.trafficLevel = trafficState.trafficLevel || 'low';
      result.trafficMultiplier = trafficState.trafficMultiplier || 1;
    }

    const actualAlgorithm = actualMode === 'road' ? 'osrm' : algorithm;
    const payload = buildResult(source, destination, actualAlgorithm, optimization, result);
    payload.routingMode = actualMode;
    payload.requestedRoutingMode = requestedMode;
    payload.requestedAlgorithm = algorithm;
    payload.provider = result.provider || (actualMode === 'demo' ? 'synthetic demo graph' : 'synthetic demo graph fallback');
    payload.trafficMode = result.trafficMode || 'simulated';
    payload.trafficLevel = result.trafficLevel || trafficState.trafficLevel || 'low';
    payload.trafficMultiplier = result.trafficMultiplier || trafficState.trafficMultiplier || 1;
    payload.geometry = result.geometry || result.pathNodes.map((node) => [node.coords.lat, node.coords.lng]);
    if (fallbackReason) payload.fallbackReason = fallbackReason;
    payload.executionTimeMs = Date.now() - startTime;
    return res.json(payload);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Route calculation failed.' });
  }
};

exports.simulateTraffic = (req, res) => {
  try {
    const { level = 'moderate' } = req.body || {};
    if (!trafficLevels.includes(level)) {
      return res.status(400).json({ error: `Traffic level must be one of: ${trafficLevels.join(', ')}.` });
    }
    trafficState = simulateTraffic(trafficState, level);
    return res.json({
      success: true,
      trafficLevel: trafficState.trafficLevel,
      trafficMultiplier: trafficState.trafficMultiplier,
      trafficMode: 'simulated',
      affectedEdges: trafficState.affectedEdges,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Traffic simulation failed.' });
  }
};

exports.getRouteHistory = async (req, res) => {
  const requestedLimit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    return res.status(400).json({ error: 'History limit must be an integer between 1 and 100.' });
  }

  try {
    if (mongoose.connection.readyState === 1) {
      const history = await RouteHistory.find({}).sort({ createdAt: -1 }).limit(requestedLimit);
      res.set('X-History-Persistence', 'mongodb');
      return res.json(history.map((entry) => ({
        ...entry.toObject(),
        persisted: true,
        storage: 'mongodb',
      })));
    }
    res.set('X-History-Persistence', 'memory-only');
    return res.json(memoryHistory.slice(0, requestedLimit).map((entry) => ({ ...entry, persisted: false, storage: 'memory' })));
  } catch (error) {
    console.error('MongoDB history read failed; returning local route history.');
    res.set('X-History-Persistence', 'memory-only');
    return res.json(memoryHistory.slice(0, requestedLimit).map((entry) => ({ ...entry, persisted: false, storage: 'memory' })));
  }
};

exports.saveRouteHistory = async (req, res) => {
  const payload = req.body || {};
  const isRoadRoute = payload.routingMode === 'road';
  const validNodeIds = new Set(roadNetworkData.nodes.map((node) => node.id));
  if (isRoadRoute) {
    try {
      validateLocation(payload.origin, 'Origin');
      validateLocation(payload.destinationLocation, 'Destination');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (typeof payload.source !== 'string' || !payload.source.trim() || typeof payload.destination !== 'string' || !payload.destination.trim()) {
      return res.status(400).json({ error: 'Origin and destination names are required.' });
    }
  } else if (!validNodeIds.has(payload.source) || !validNodeIds.has(payload.destination)) {
    return res.status(400).json({ error: 'Valid source and destination identifiers are required.' });
  }
  if (!['dijkstra', 'astar', 'osrm', 'tomtom-traffic'].includes(payload.algorithm) || !['distance', 'time'].includes(payload.optimization)) {
    return res.status(400).json({ error: 'A valid algorithm and optimization are required.' });
  }
  if (payload.path !== undefined && (!Array.isArray(payload.path) || payload.path.some((nodeId) => typeof nodeId !== 'string'))) {
    return res.status(400).json({ error: 'Path must be an array of node identifiers.' });
  }
  if (payload.geometry !== undefined && (!Array.isArray(payload.geometry) || payload.geometry.some((point) => (
    !Array.isArray(point) || point.length !== 2 || point.some((coordinate) => !Number.isFinite(Number(coordinate)))
  )))) {
    return res.status(400).json({ error: 'Geometry must be an array of finite [latitude, longitude] points.' });
  }
  const numericValues = [
    payload.distanceKm ?? payload.distance ?? 0,
    payload.estimatedMinutes ?? payload.estimatedTime ?? 0,
    payload.totalCost ?? 0,
    payload.executionTimeMs ?? payload.executionTime ?? 0,
  ];
  if (numericValues.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    return res.status(400).json({ error: 'Route metrics must be finite non-negative numbers.' });
  }

  const record = toHistoryRecord(payload);
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey && (idempotencyKey.length > 128 || !/^[\w.:-]+$/.test(idempotencyKey))) {
    return res.status(400).json({ error: 'Idempotency-Key must contain at most 128 letters, numbers, dots, colons, underscores, or hyphens.' });
  }
  if (idempotencyKey) record.idempotencyKey = idempotencyKey;

  try {
    if (mongoose.connection.readyState === 1) {
      try {
        const saved = idempotencyKey
          ? await RouteHistory.findOneAndUpdate(
            { idempotencyKey },
            { $setOnInsert: record },
            { new: true, upsert: true, runValidators: true, includeResultMetadata: true },
          )
          : { value: await RouteHistory.create(record), lastErrorObject: { updatedExisting: false } };
        const document = saved.value || saved;
        const statusCode = saved.lastErrorObject?.updatedExisting ? 200 : 201;
        return res.status(statusCode).json({ ...document.toObject(), persisted: true, storage: 'mongodb' });
      } catch (error) {
        console.error('MongoDB history write failed; saving route in memory.');
      }
    }

    if (idempotencyKey) {
      const existing = memoryHistory.find((entry) => entry.idempotencyKey === idempotencyKey);
      if (existing) return res.status(202).json({ ...existing, persisted: false, storage: 'memory' });
    }

    memoryHistory.unshift(record);
    memoryHistory.splice(20);
    return res.status(202).json({ ...record, persisted: false, storage: 'memory' });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to save route history.' });
  }
};