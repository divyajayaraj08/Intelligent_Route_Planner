const mongoose = require('mongoose');

const RouteHistorySchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    destination: { type: String, required: true },
    origin: {
      name: { type: String, default: '' },
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    destinationLocation: {
      name: { type: String, default: '' },
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    algorithm: { type: String, required: true },
    optimization: { type: String, required: true },
    path: { type: [String], default: [] },
    geometry: { type: [[Number]], default: [] },
    distance: { type: Number, default: 0 },
    estimatedTime: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    executionTime: { type: Number, default: 0 },
    congestion: { type: String, default: 'low' },
    provider: { type: String, default: 'demo-graph' },
    routingMode: { type: String, default: 'demo' },
    trafficStatus: { type: mongoose.Schema.Types.Mixed, default: null },
    trafficRetrievedAt: { type: Date, default: null },
    alternatives: { type: [mongoose.Schema.Types.Mixed], default: [] },
    idempotencyKey: { type: String, unique: true, sparse: true, maxlength: 128 },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'route_history' }
);

module.exports = mongoose.model('RouteHistory', RouteHistorySchema);
