import { useState } from 'react';
import LocationSearchInput from './LocationSearchInput';

export default function RouteForm({ locations, source, destination, origin, destinationLocation, liveTrafficConfigured, onSourceChange, onDestinationChange, onOriginSelect, onOriginClear, onDestinationSelect, onDestinationClear, routingMode, onRoutingModeChange, onSubmit }) {
  const [algorithm, setAlgorithm] = useState('dijkstra');
  const [optimization, setOptimization] = useState('distance');
  const [validationMessage, setValidationMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (routingMode === 'road') {
      if (!origin || !destinationLocation) {
        setValidationMessage('Select an origin and destination from the location suggestions.');
        return;
      }
      setValidationMessage('');
      onSubmit({ source: origin, destination: destinationLocation, algorithm, optimization, routingMode });
    } else if (source && destination) {
      setValidationMessage('');
      onSubmit({ source, destination, algorithm, optimization, routingMode });
    } else {
      setValidationMessage('Choose both demo graph endpoints.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {routingMode === 'road' ? (
        <>
          <LocationSearchInput label="Starting location" selectedLocation={origin} onSelect={onOriginSelect} onClear={onOriginClear} placeholder="Search a city, station, address…" />
          <LocationSearchInput label="Destination" selectedLocation={destinationLocation} onSelect={onDestinationSelect} onClear={onDestinationClear} placeholder="Search a city, station, address…" />
          <p className="text-xs text-slate-500">Search results by OpenStreetMap Nominatim. Public service rate limits apply.</p>
          <p className={`text-xs ${liveTrafficConfigured ? 'text-emerald-700' : 'text-amber-800'}`}>
            {liveTrafficConfigured
              ? 'TomTom live traffic is configured. If it is unavailable, standard OSRM routing is used and labeled.'
              : 'TomTom live traffic is not configured. Standard OSRM routes will be used without live traffic data.'}
          </p>
        </>
      ) : (
        <>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Demo origin</label>
            <select value={source} onChange={(event) => onSourceChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none ring-0 transition focus:border-blue-400" disabled={locations.length === 0}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Demo destination</label>
            <select value={destination} onChange={(event) => onDestinationChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-blue-400" disabled={locations.length === 0}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </div>
        </>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Routing network</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'road', label: 'OpenStreetMap roads' },
            { id: 'demo', label: 'Demo graph' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRoutingModeChange(item.id)}
              aria-pressed={routingMode === item.id}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${routingMode === item.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {routingMode === 'road'
            ? 'Uses selected OpenStreetMap search results and OSRM road routes. Provider failures are shown; no synthetic route is substituted.'
            : 'Runs the selected Dijkstra or A* algorithm on the synthetic demonstration graph.'}
        </p>
      </div>

      {routingMode === 'demo' && <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Algorithm</label>
        <div className="grid grid-cols-2 gap-3">
          {['dijkstra', 'astar'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setAlgorithm(item)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${algorithm === item ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
            >
              {item === 'dijkstra' ? 'Dijkstra' : 'A*'}
            </button>
          ))}
        </div>
      </div>}

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Optimization</label>
        <div className="grid grid-cols-2 gap-3">
          {['distance', 'time'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setOptimization(item)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${optimization === item ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
            >
              {item === 'distance' ? 'Shortest distance' : 'Fastest time'}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-500 hover:to-blue-400">
        Find routes
      </button>
      {validationMessage && <p className="text-sm text-red-700" role="alert">{validationMessage}</p>}
    </form>
  );
}
