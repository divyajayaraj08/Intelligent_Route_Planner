import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export default function LocationSearchInput({ label, selectedLocation, onSelect, onClear, placeholder }) {
  const [query, setQuery] = useState(selectedLocation?.displayName || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (selectedLocation) setQuery(selectedLocation.displayName || selectedLocation.name || '');
  }, [selectedLocation]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (selectedLocation || trimmedQuery.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setHasSearched(false);
      setError('');
      return undefined;
    }

    const currentRequest = ++requestId.current;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/locations/search', { params: { q: trimmedQuery } });
        if (currentRequest === requestId.current) {
          setSuggestions(response.data.results || []);
          setHasSearched(true);
        }
      } catch (requestError) {
        if (currentRequest === requestId.current) {
          setSuggestions([]);
          setHasSearched(false);
          setError(requestError?.response?.data?.error || 'Location search is unavailable.');
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 700);

    return () => clearTimeout(timeout);
  }, [query, selectedLocation]);

  const handleChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setHasSearched(false);
    setError('');
    onClear();
  };

  const chooseSuggestion = (result) => {
    setQuery(result.displayName);
    setSuggestions([]);
    onSelect(result);
  };

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>
      <input
        type="search"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-blue-400"
      />
      {loading && <p className="mt-1 text-xs text-slate-500" role="status">Searching OpenStreetMap…</p>}
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
      {!loading && !error && query.trim().length >= 3 && !selectedLocation && suggestions.length === 0 && (
        hasSearched && <p className="mt-1 text-xs text-slate-500">No matching locations found.</p>
      )}
      {suggestions.length > 0 && (
        <ul className="absolute z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl" role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.map((result) => (
            <li key={result.id}>
              <button type="button" role="option" aria-selected="false" onClick={() => chooseSuggestion(result)}
                className="w-full px-3 py-2 text-left transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none">
                <span className="block text-sm font-semibold text-slate-800">{result.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{result.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selectedLocation && (
        <p className="mt-1 text-xs text-emerald-700">Selected coordinates: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</p>
      )}
    </div>
  );
}