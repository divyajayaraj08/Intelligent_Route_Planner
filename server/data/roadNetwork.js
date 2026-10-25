const nodes = [
  { id: 'A', name: 'Central Station', coords: { lat: 12.9716, lng: 77.5946 } },
  { id: 'B', name: 'Tech Park', coords: { lat: 12.976, lng: 77.6012 } },
  { id: 'C', name: 'Old Town', coords: { lat: 12.9815, lng: 77.5928 } },
  { id: 'D', name: 'Lake View', coords: { lat: 12.9668, lng: 77.5861 } },
  { id: 'E', name: 'Market Square', coords: { lat: 12.9613, lng: 77.6014 } },
  { id: 'F', name: 'Transit Hub', coords: { lat: 12.9841, lng: 77.6071 } },
];

const edges = [
  { id: 'A-B', from: 'A', to: 'B', distanceKm: 3.4, estimatedMinutes: 8, traffic: 'low', cost: 12.5 },
  { id: 'A-C', from: 'A', to: 'C', distanceKm: 2.8, estimatedMinutes: 7, traffic: 'moderate', cost: 10.8 },
  { id: 'A-D', from: 'A', to: 'D', distanceKm: 4.1, estimatedMinutes: 10, traffic: 'low', cost: 14.2 },
  { id: 'B-C', from: 'B', to: 'C', distanceKm: 4.0, estimatedMinutes: 9, traffic: 'low', cost: 13.7 },
  { id: 'B-E', from: 'B', to: 'E', distanceKm: 4.7, estimatedMinutes: 11, traffic: 'moderate', cost: 16.3 },
  { id: 'B-F', from: 'B', to: 'F', distanceKm: 3.1, estimatedMinutes: 8, traffic: 'low', cost: 11.2 },
  { id: 'C-F', from: 'C', to: 'F', distanceKm: 3.6, estimatedMinutes: 9, traffic: 'moderate', cost: 12.9 },
  { id: 'C-D', from: 'C', to: 'D', distanceKm: 3.9, estimatedMinutes: 10, traffic: 'heavy', cost: 14.8 },
  { id: 'D-E', from: 'D', to: 'E', distanceKm: 4.4, estimatedMinutes: 12, traffic: 'moderate', cost: 15.3 },
  { id: 'E-F', from: 'E', to: 'F', distanceKm: 5.6, estimatedMinutes: 14, traffic: 'heavy', cost: 20.4 },
];

module.exports = {
  nodes,
  edges,
};
