export default function Navbar() {
  return (
    <nav className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Operations</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Route Intelligence Dashboard</h1>
      </div>

      <p className="hidden text-sm text-slate-500 md:block">Road directions · traffic availability shown per route</p>
    </nav>
  );
}
