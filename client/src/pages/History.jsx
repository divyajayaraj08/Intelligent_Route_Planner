import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

export default function History() {
  const [history, setHistory] = useState([]);
  const [persistence, setPersistence] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/routes/history')
      .then((response) => {
        setHistory(response.data || []);
        setPersistence(response.headers['x-history-persistence'] || 'unknown');
      })
      .catch(() => {
        setHistory([]);
        setPersistence('unavailable');
        setError('Unable to load route history.');
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 lg:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 p-3 sm:p-5 md:p-8">
        <Navbar />

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Route history</h2>
          <p className="mt-2 text-sm text-slate-500" role="status">
            {persistence === 'mongodb' && 'History is connected to MongoDB.'}
            {persistence === 'memory-only' && 'MongoDB is unavailable. These history records are temporary and will not survive a server restart.'}
            {persistence === 'loading' && 'Loading history...'}
            {persistence === 'unavailable' && 'History is currently unavailable.'}
          </p>

          {error ? (
            <p className="mt-4 text-red-600">{error}</p>
          ) : history.length === 0 ? (
            <p className="mt-4 text-slate-500">No saved route calculations yet.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {history.map((item, index) => (
                <div key={item._id || `${item.source}-${item.destination}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-lg font-semibold text-slate-800">{item.source} → {item.destination}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.15em] text-slate-400">
                      <span>{item.provider || item.algorithm}</span>
                      <span>{item.persisted === false ? 'Temporary' : 'Saved'}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                    <div><span className="block text-slate-400">Optimization</span>{item.optimization}</div>
                    <div><span className="block text-slate-400">Distance</span>{item.distance ?? item.distanceKm ?? 0} km</div>
                    <div><span className="block text-slate-400">Time</span>{item.estimatedTime ?? item.estimatedMinutes ?? 0} min</div>
                    <div><span className="block text-slate-400">Saved</span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Timestamp unavailable'}</div>
                  </div>
                  {item.trafficStatus?.message && (
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="text-slate-400">Traffic: </span>{item.trafficStatus.message}
                      {item.trafficRetrievedAt && ` Retrieved ${new Date(item.trafficRetrievedAt).toLocaleString()}.`}
                    </p>
                  )}
                  {item.path?.length > 0 && (
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="text-slate-400">Path: </span>{item.path.join(' → ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
