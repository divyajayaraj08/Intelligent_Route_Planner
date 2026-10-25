import { Clock3, MapPinned, Route, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const menuItems = [
  { label: 'Overview', path: '/', icon: MapPinned },
  { label: 'History', path: '/history', icon: Clock3 },
];

export default function Sidebar() {
  return (
    <aside className="flex min-h-0 w-full flex-wrap items-center justify-between bg-slate-950 px-3 py-3 text-slate-100 lg:min-h-screen lg:w-[260px] lg:flex-nowrap lg:flex-col lg:items-stretch lg:justify-start lg:px-5 lg:py-6">
      <div className="mb-0 flex items-center gap-2 px-1 lg:mb-10 lg:gap-3 lg:px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-lg shadow-blue-500/20">
          <Route className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Fleet</div>
          <div className="text-xl font-bold">SmartRoute</div>
        </div>
      </div>

      <nav className="flex items-center gap-1 lg:block lg:space-y-2">
        {menuItems.map(({ label, path, icon: Icon }) => (
          <Link key={label} to={path} className="sidebar-link px-2 py-2 text-sm lg:gap-3 lg:px-4 lg:py-3 lg:text-base">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto hidden rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 p-4 ring-1 ring-blue-400/20 lg:block">
        <div className="mb-2 flex items-center gap-2 text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-sm font-medium">System status</span>
        </div>
        <p className="text-sm text-slate-300">Live traffic depends on provider configuration. Demo traffic is simulated.</p>
      </div>
    </aside>
  );
}
