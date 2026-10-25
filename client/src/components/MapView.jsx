import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const toLatLng = (node) => [node.coords.lat, node.coords.lng];

function RouteViewport({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
  }, [map, points]);

  return null;
}

function EndpointViewport({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) map.setView([location.lat, location.lng], Math.max(map.getZoom(), 13));
  }, [location, map]);
  return null;
}

export default function MapView({ nodes = [], routePath = [], routeGeometry = [], alternatives = [], selectedRouteId, sourceId, destinationId, origin, destinationLocation, activeTarget, onLocationSelect }) {
  const sourceNode = nodes.find((node) => node.id === sourceId) ?? null;
  const destinationNode = nodes.find((node) => node.id === destinationId) ?? null;
  const routeCoordinates = routeGeometry.length > 1
    ? routeGeometry
    : routePath
    .map((nodeId) => {
      const node = nodes.find((entry) => entry.id === nodeId);
      return node ? toLatLng(node) : null;
    })
    .filter(Boolean);

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
      <MapContainer center={[12.9735, 77.5965]} zoom={13} scrollWheelZoom className="h-[480px] w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <EndpointViewport location={origin || destinationLocation} />
        <RouteViewport points={routeCoordinates} />

        {nodes.map((node) => (
          <CircleMarker
            key={node.id}
            center={toLatLng(node)}
            radius={7}
            eventHandlers={{ click: () => onLocationSelect?.(node.id) }}
            pathOptions={{ color: '#475569', fillColor: '#93c5fd', fillOpacity: 1 }}
          >
            <Tooltip>{node.name}; click to set {activeTarget}.</Tooltip>
          </CircleMarker>
        ))}

        {alternatives.filter((route) => route.id !== selectedRouteId && route.geometry?.length > 1).map((route) => (
          <Polyline key={route.id} positions={route.geometry} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.55, dashArray: '7 8' }} />
        ))}

        {routeCoordinates.length > 1 && (
          <Polyline positions={routeCoordinates} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.95 }} />
        )}

        {sourceNode && (
          <CircleMarker center={toLatLng(sourceNode)} radius={10} eventHandlers={{ click: () => onLocationSelect?.(sourceNode.id) }}
            pathOptions={{ color: '#fff', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}>
            <Tooltip>Start: {sourceNode.name}; click to set {activeTarget}.</Tooltip>
          </CircleMarker>
        )}

        {destinationNode && (
          <CircleMarker center={toLatLng(destinationNode)} radius={10} eventHandlers={{ click: () => onLocationSelect?.(destinationNode.id) }}
            pathOptions={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}>
            <Tooltip>Destination: {destinationNode.name}; click to set {activeTarget}.</Tooltip>
          </CircleMarker>
        )}

        {origin?.lat !== undefined && origin?.lng !== undefined && (
          <CircleMarker center={[origin.lat, origin.lng]} radius={10}
            pathOptions={{ color: '#fff', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}>
            <Tooltip>Start: {origin.displayName || origin.name}</Tooltip>
          </CircleMarker>
        )}

        {destinationLocation?.lat !== undefined && destinationLocation?.lng !== undefined && (
          <CircleMarker center={[destinationLocation.lat, destinationLocation.lng]} radius={10}
            pathOptions={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}>
            <Tooltip>Destination: {destinationLocation.displayName || destinationLocation.name}</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
