const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const RouteHistory = require('../models/RouteHistory');
const app = require('../server');

test('MongoDB saves and retrieves a calculated route across a connection restart', { skip: !process.env.MONGODB_URI }, async (t) => {
  const connected = await connectDB();
  if (!connected) {
    if (!/DNS\/SRV|network|timeout|server selection/i.test(connectDB.lastFailureReason || '')) {
      assert.fail(`MongoDB connection failed: ${connectDB.lastFailureReason || 'unknown configuration error'}`);
    }
    t.skip(`External MongoDB connectivity unavailable: ${connectDB.lastFailureReason}.`);
    return;
  }

  let server;
  let savedId;

  try {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    let baseUrl = `http://localhost:${server.address().port}/api`;
    const routeResponse = await fetch(`${baseUrl}/routes/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'A', destination: 'E', algorithm: 'dijkstra', optimization: 'distance', routingMode: 'demo' }),
    });
    const route = await routeResponse.json();
    assert.equal(routeResponse.status, 200);

    const saveResponse = await fetch(`${baseUrl}/routes/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    const savedRoute = await saveResponse.json();
    assert.equal(saveResponse.status, 201);
    assert.equal(savedRoute.persisted, true);
    assert.ok(savedRoute._id);
    savedId = savedRoute._id;

    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await mongoose.disconnect();
    assert.equal(await connectDB(), true);

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://localhost:${server.address().port}/api`;
    const historyResponse = await fetch(`${baseUrl}/routes/history`);
    const history = await historyResponse.json();
    assert.equal(historyResponse.status, 200);
    assert.ok(history.some((entry) => String(entry._id) === String(savedId)));
  } finally {
    if (savedId) await RouteHistory.deleteOne({ _id: savedId });
    if (server?.listening) {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
    await mongoose.disconnect();
  }
});