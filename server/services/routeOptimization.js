const { calculateRouteBetweenLocations } = require('./roadRouting');
const { calculateTomTomTrafficRoutes } = require('./trafficRouting');

function selectByObjective(routes, optimization) {
  const field = optimization === 'time' ? 'estimatedMinutes' : 'distanceKm';
  return routes.reduce((best, route) => route[field] < best[field] ? route : best);
}

function normalizeStandardRoute(standardRoute, optimization, status) {
  const routes = standardRoute.alternatives?.length ? standardRoute.alternatives : [standardRoute];
  const selectedRoute = selectByObjective(routes, optimization);
  return {
    ...standardRoute,
    ...selectedRoute,
    totalCost: selectedRoute.distanceKm + selectedRoute.estimatedMinutes * 0.4,
    routes,
    selectedRouteId: selectedRoute.id || standardRoute.selectedAlternativeId,
    provider: standardRoute.provider,
    trafficStatus: status,
  };
}

async function calculateOptimizedRoute(origin, destination, optimization, options = {}) {
  if (!['distance', 'time'].includes(optimization)) {
    const error = new Error('Optimization must be distance or time.');
    error.statusCode = 400;
    throw error;
  }

  const tomtomKey = options.tomtomApiKey ?? process.env.TOMTOM_API_KEY;
  if (tomtomKey) {
    try {
      const trafficResult = await (options.trafficRouter || calculateTomTomTrafficRoutes)(origin, destination, optimization, {
        apiKey: tomtomKey,
        fetchImpl: options.tomtomFetch,
      });
      const selectedRoute = selectByObjective(trafficResult.routes, optimization);
      return {
        ...selectedRoute,
        totalCost: selectedRoute.distanceKm + selectedRoute.estimatedMinutes * 0.4,
        routes: trafficResult.routes,
        selectedRouteId: selectedRoute.id,
        provider: trafficResult.provider,
        trafficStatus: trafficResult.trafficStatus,
      };
    } catch (error) {
      const standardRoute = await (options.standardRouter || calculateRouteBetweenLocations)(origin, destination, optimization, options.osrmFetch);
      return normalizeStandardRoute(standardRoute, optimization, {
        state: 'fallback',
        message: 'Live traffic data is unavailable. Showing a standard road route instead.',
        retrievedAt: null,
        fallbackReason: error.providerCode || 'PROVIDER_ERROR',
      });
    }
  }

  const standardRoute = await (options.standardRouter || calculateRouteBetweenLocations)(origin, destination, optimization, options.osrmFetch);
  return normalizeStandardRoute(standardRoute, optimization, {
    state: 'unavailable',
    message: 'Live traffic data is not configured. Showing a standard road route instead.',
    retrievedAt: null,
    fallbackReason: 'MISSING_TOMTOM_API_KEY',
  });
}

module.exports = { calculateOptimizedRoute, selectByObjective };