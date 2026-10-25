import { useEffect, useMemo, useRef, useState } from 'react';
import { Bolt, MapPinned, TimerReset } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import MapView from '../components/MapView';
import RouteForm from '../components/RouteForm';
import RouteCard from '../components/RouteCard';
import TrafficLegend from '../components/TrafficLegend';
import api from '../services/api';

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationsError, setLocationsError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [savingHistory, setSavingHistory] = useState(false);
  const [source, setSource] = useState('A');
  const [destination, setDestination] = useState('D');
  const [origin, setOrigin] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [routingMode, setRoutingMode] = useState('road');
  const [mapTarget, setMapTarget] = useState('source');
  const [trafficLevel, setTrafficLevel] = useState('low');
  const [liveTrafficConfigured, setLiveTrafficConfigured] = useState(false);
  const historyIdempotencyKey = useRef(null);

  useEffect(() => {
    Promise.all([api.get('/locations'), api.get('/health')])
      .then(([locationsResponse, healthResponse]) => {
        setLocations(locationsResponse.data || []);
        setTrafficLevel(healthResponse.data.trafficLevel || 'low');
        setLiveTrafficConfigured(Boolean(healthResponse.data.liveTrafficConfigured));
        setLocationsError('');
      })
      .catch(() => {
        setLocations([]);
        setLocationsError('Locations or server status could not be loaded from the route API.');
      });
  }, []);

  const stats = useMemo(() => {
    return [
      { label: 'Demo locations', value: locations.length, icon: MapPinned },
      { label: 'Traffic data', value: route?.trafficStatus?.state === 'live' ? 'LIVE' : route?.trafficMode === 'simulated' ? trafficLevel.toUpperCase() : route ? 'UNAVAILABLE' : '—', icon: Bolt },
      { label: 'Latest metric', value: route ? `${route.distanceKm} km` : '—', icon: TimerReset },
    ];
  }, [locations.length, route, trafficLevel]);

  const handleRouteSubmit = async (params) => {
    setLoading(true);
    setError('');
    setSaveNotice('');
    try {
      historyIdempotencyKey.current = null;
      const response = await api.post('/routes/calculate', params);
      setRoute(response.data);
      setRoutingMode(params.routingMode);
      if (params.routingMode === 'road') {
        setOrigin(params.source);
        setDestinationLocation(params.destination);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to compute route.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrafficUpdate = async () => {
    const nextLevel = trafficLevel === 'low' ? 'moderate' : trafficLevel === 'moderate' ? 'heavy' : 'low';
    try {
      const trafficResponse = await api.post('/traffic/simulate', { level: nextLevel });
      setTrafficLevel(trafficResponse.data.trafficLevel);
      setError('');
      if (route && routingMode === 'demo') {
        historyIdempotencyKey.current = null;
        const params = route.routingMode === 'road'
          ? {
            source: route.origin,
            destination: route.destinationLocation,
            algorithm: 'dijkstra',
            optimization: route.optimization,
            routingMode: 'road',
          }
          : {
            source: route.source,
            destination: route.destination,
            algorithm: route.requestedAlgorithm || route.algorithm,
            optimization: route.optimization,
            routingMode: 'demo',
          };
        const response = await api.post('/routes/calculate', params);
        setRoute(response.data);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Traffic update failed.');
    }
  };

  const handleSaveHistory = async () => {
    if (!route || savingHistory) return;
    setSavingHistory(true);
    setError('');
    setSaveNotice('');
    try {
      historyIdempotencyKey.current ||= globalThis.crypto.randomUUID();
      const response = await api.post('/routes/history', {
        source: route.source,
        destination: route.destination,
        algorithm: route.algorithm,
        optimization: route.optimization,
        path: route.path,
        distanceKm: route.distanceKm,
        estimatedMinutes: route.estimatedMinutes,
        executionTimeMs: route.executionTimeMs,
        totalCost: route.totalCost,
        congestion: route.congestion,
        geometry: route.geometry,
        provider: route.provider,
        routingMode: route.routingMode,
        origin: route.origin,
        destinationLocation: route.destinationLocation,
        trafficStatus: route.trafficStatus,
        trafficRetrievedAt: route.trafficRetrievedAt,
        alternatives: route.alternatives,
      }, { headers: { 'Idempotency-Key': historyIdempotencyKey.current } });
      setSaveNotice(response.data.persisted
        ? 'Route saved to MongoDB.'
        : 'MongoDB is unavailable. Route is saved for this session only.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to save route.');
    } finally {
      setSavingHistory(false);
    }
  };

  const handleMapLocationSelect = (locationId) => {
    let nextSource = source;
    let nextDestination = destination;
    if (mapTarget === 'source') {
      nextSource = locationId;
      setSource(locationId);
      setMapTarget('destination');
    } else {
      nextDestination = locationId;
      setDestination(locationId);
      setMapTarget('source');
    }
    handleRouteSubmit({
      source: nextSource,
      destination: nextDestination,
      algorithm: route?.requestedAlgorithm || 'dijkstra',
      optimization: route?.optimization || 'distance',
      routingMode,
    });
  };

  const handleSourceChange = (locationId) => {
    setSource(locationId);
    handleRouteSubmit({
      source: locationId,
      destination,
      algorithm: route?.requestedAlgorithm || 'dijkstra',
      optimization: route?.optimization || 'distance',
      routingMode,
    });
  };

  const handleOriginSelect = (selected) => {
    setOrigin(selected);
    setRoute(null);
    setSaveNotice('');
    if (destinationLocation) {
      handleRouteSubmit({ source: selected, destination: destinationLocation, algorithm: 'dijkstra', optimization: 'distance', routingMode: 'road' });
    }
  };

  const handleDestinationSelect = (selected) => {
    setDestinationLocation(selected);
    setRoute(null);
    setSaveNotice('');
    if (origin) {
      handleRouteSubmit({ source: origin, destination: selected, algorithm: 'dijkstra', optimization: 'distance', routingMode: 'road' });
    }
  };

  const handleOriginClear = () => {
    setOrigin(null);
    setRoute(null);
    setSaveNotice('');
  };

  const handleDestinationClear = () => {
    setDestinationLocation(null);
    setRoute(null);
    setSaveNotice('');
  };

  const handleDestinationChange = (locationId) => {
    setDestination(locationId);
    handleRouteSubmit({
      source,
      destination: locationId,
      algorithm: route?.requestedAlgorithm || 'dijkstra',
      optimization: route?.optimization || 'distance',
      routingMode,
    });
  };

  const handleRoutingModeChange = (mode) => {
    setRoutingMode(mode);
    setRoute(null);
    setError('');
    setSaveNotice('');
  };

  const handleAlternativeSelect = (alternative) => {
    historyIdempotencyKey.current = null;
    setRoute((current) => current ? {
      ...current,
      distanceKm: alternative.distanceKm,
      estimatedMinutes: alternative.estimatedMinutes,
      totalCost: alternative.distanceKm + alternative.estimatedMinutes * 0.4,
      geometry: alternative.geometry,
      selectedRouteId: alternative.id,
      trafficStatus: current.trafficStatus ? {
        ...current.trafficStatus,
        delayMinutes: alternative.trafficDelayMinutes ?? null,
      } : null,
      trafficRetrievedAt: current.trafficRetrievedAt,
      alternatives: current.alternatives.map((routeItem) => ({
        ...routeItem,
        selected: routeItem.id === alternative.id,
      })),
    } : current);
    setSaveNotice('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 lg:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 p-3 sm:p-5 md:p-8">
        <Navbar />

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="stat-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
                  <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[1.6fr_0.8fr]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Map view</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">OpenStreetMap road network</h2>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {routingMode === 'demo' && <div className="flex rounded-lg border border-slate-200 p-1" aria-label="Select map pin target">
                  {['source', 'destination'].map((target) => (
                    <button key={target} type="button" onClick={() => setMapTarget(target)} aria-pressed={mapTarget === target}
                      className={`rounded-md px-2 py-1.5 text-xs font-medium capitalize ${mapTarget === target ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
                      {target}
                    </button>
                  ))}
                </div>}
                {routingMode === 'demo' && <button onClick={handleTrafficUpdate} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                  Simulate traffic
                </button>}
              </div>
            </div>

            {locationsError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{locationsError}</p>}
            {route && (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600" role="status">
                Route source: {route.provider}. {route.trafficStatus?.message || (route.routingMode === 'demo' ? 'Synthetic graph route.' : 'Standard route; live traffic unavailable.')}
              </p>
            )}
            <MapView nodes={routingMode === 'demo' ? locations : []} routePath={route?.path || []} routeGeometry={route?.geometry || []}
              alternatives={route?.alternatives || []} selectedRouteId={route?.selectedRouteId}
              sourceId={source} destinationId={destination} origin={origin} destinationLocation={destinationLocation}
              activeTarget={mapTarget} onLocationSelect={handleMapLocationSelect} />
            <TrafficLegend mode={routingMode} />
          </div>

          <div className="min-w-0 space-y-4">
            <RouteForm locations={locations} source={source} destination={destination} liveTrafficConfigured={liveTrafficConfigured} onSourceChange={handleSourceChange}
              origin={origin} destinationLocation={destinationLocation} onOriginSelect={handleOriginSelect} onOriginClear={handleOriginClear}
              onDestinationSelect={handleDestinationSelect} onDestinationClear={handleDestinationClear}
              onDestinationChange={handleDestinationChange} routingMode={routingMode} onRoutingModeChange={handleRoutingModeChange}
              onSubmit={handleRouteSubmit} />

            {loading && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                Calculating best route...
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <RouteCard route={route} onSaveHistory={handleSaveHistory} onSelectAlternative={handleAlternativeSelect}
              saveNotice={saveNotice} savingHistory={savingHistory} />
          </div>
        </section>
      </main>
    </div>
  );
}
