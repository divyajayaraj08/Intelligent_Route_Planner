export default function RouteCard({ route, onSaveHistory, saveNotice, savingHistory = false, onSelectAlternative }) {
  if (!route) return null;

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">Selected route</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${route.trafficStatus?.state === 'live' ? 'bg-emerald-100 text-emerald-800' : route.trafficMode === 'simulated' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          {route.trafficStatus?.state === 'live' ? 'Live traffic' : route.trafficMode === 'simulated' ? `Simulated ${route.trafficLevel || 'low'} traffic` : 'Standard routing'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Algorithm</p>
          <p className="mt-1 font-semibold text-slate-800">{route.algorithm}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Optimization</p>
          <p className="mt-1 font-semibold text-slate-800">{route.optimization}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Distance</p>
          <p className="mt-1 font-semibold text-slate-800">{route.distanceKm} km</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Estimated time</p>
          <p className="mt-1 font-semibold text-slate-800">{route.estimatedMinutes} min</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Route source</p>
          <p className="mt-1 font-semibold text-slate-800">{route.provider}</p>
        </div>
        {route.trafficStatus?.state === 'live' && route.trafficStatus.retrievedAt && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Traffic retrieved</p>
            <p className="mt-1 font-semibold text-slate-800">{new Date(route.trafficStatus.retrievedAt).toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      {route.trafficStatus?.message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${route.trafficStatus.state === 'live' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`} role="status">
          {route.trafficStatus.message}
        </p>
      )}
      {route.trafficStatus?.state === 'live' && route.trafficStatus.delayMinutes !== null && (
        <p className="mt-2 text-xs text-slate-500">Traffic delay estimate: {route.trafficStatus.delayMinutes.toFixed(1)} min</p>
      )}

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <p className="text-xs uppercase tracking-wide text-slate-400">Route path</p>
        <p className="mt-1 font-medium text-slate-800">{route.path?.join(' → ') || 'No route available'}</p>
      </div>

      {route.alternatives?.length > 1 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Route alternatives</h4>
          {route.alternatives.map((alternative, index) => (
            <button key={alternative.id || index} type="button" onClick={() => onSelectAlternative(alternative)}
              aria-pressed={alternative.id === route.selectedRouteId}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm ${alternative.id === route.selectedRouteId ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <span>{alternative.id === route.selectedRouteId ? 'Selected recommendation' : `Alternative ${index + 1}`}</span>
              <span>{alternative.distanceKm.toFixed(1)} km · {alternative.estimatedMinutes.toFixed(1)} min</span>
            </button>
          ))}
        </div>
      )}

      <button onClick={onSaveHistory} disabled={savingHistory} className="mt-4 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60">
        {savingHistory ? 'Saving route...' : 'Save to history'}
      </button>
      {saveNotice && <p className="mt-2 text-sm text-slate-600" role="status">{saveNotice}</p>}
    </div>
  );
}
