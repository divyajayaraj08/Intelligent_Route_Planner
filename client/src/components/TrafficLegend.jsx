export default function TrafficLegend({ mode = 'demo' }) {
  if (mode !== 'demo') {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Road routing uses provider travel-time estimates. Live traffic is marked only when TomTom returns traffic-aware data.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-emerald-500" /> Low</div>
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-amber-400" /> Moderate</div>
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-red-500" /> Heavy</div>
      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Simulated traffic multipliers; no live feed</span>
    </div>
  );
}
